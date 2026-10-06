// Painel admin: gestão de usuários — só a equipe da plataforma.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { Deps } from '../app.js';
import { hashPassword, temporaryPassword } from '../auth/password.js';
import { requireAuth, revokeUserSessions } from '../auth/session.js';
import { badRequest, notFound } from '../errors.js';
import { toManagedUser, type ManagedUserRow } from '../mappers.js';
import { email, idParams, uuid } from '../validation.js';

const USER_COLUMNS = `
  u.id, u.name, u.email, u.cpf, u.role, u.tenant_id, t.name as tenant_name,
  u.disabled_at, u.created_at, u.last_login_at
`;

const adminRole = z.enum(['platform_admin', 'tenant_admin']);

export async function adminUserRoutes(app: FastifyInstance, { db, config }: Deps) {
  app.addHook('preHandler', requireAuth(db, config.JWT_SECRET, ['platform_admin']));

  async function getUser(id: string) {
    const { rows } = await db.query<ManagedUserRow>(
      `select ${USER_COLUMNS} from users u left join tenants t on t.id = u.tenant_id where u.id = $1`,
      [id],
    );
    if (!rows[0]) throw notFound('Usuário não encontrado.');
    return rows[0];
  }

  async function assertTenantExists(tenantId: string) {
    const { rowCount } = await db.query('select 1 from tenants where id = $1', [tenantId]);
    if (!rowCount) throw badRequest('Franquia não encontrada.');
  }

  app.get('/users', async (request) => {
    const query = z
      .object({
        search: z.string().max(100).optional().default(''),
        tenantId: uuid.optional(),
        includeCustomers: z
          .enum(['true', 'false'])
          .optional()
          .transform((value) => value === 'true'),
      })
      .parse(request.query);
    const term = query.search.trim().replace(/[\\%_]/g, '\\$&');
    const { rows } = await db.query<ManagedUserRow>(
      `select ${USER_COLUMNS}
       from users u left join tenants t on t.id = u.tenant_id
       where ($1::uuid is null or u.tenant_id = $1)
         and ($2 or u.role <> 'customer')
         and ($3 = '' or u.name ilike '%' || $3 || '%' or u.email ilike '%' || $3 || '%' or u.cpf like $3 || '%')
       order by u.created_at desc
       limit 200`,
      [query.tenantId ?? null, query.includeCustomers, term],
    );
    return rows.map(toManagedUser);
  });

  app.get('/users/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    return toManagedUser(await getUser(id));
  });

  /** Cria acesso ao painel com senha temporária (trocada no primeiro login). */
  app.post('/users', async (request, reply) => {
    const body = z
      .object({
        email,
        name: z.string().trim().max(120).default(''),
        role: adminRole,
        tenantId: uuid.nullish(),
      })
      .parse(request.body);
    if (body.role === 'tenant_admin') {
      if (!body.tenantId) throw badRequest('Administrador de franquia precisa de uma franquia.');
      await assertTenantExists(body.tenantId);
    }

    const password = temporaryPassword();
    const { rows } = await db.query<{ id: string }>(
      `insert into users (role, tenant_id, name, email, password_hash, must_change_password)
       values ($1, $2, $3, $4, $5, true) returning id`,
      [body.role, body.role === 'platform_admin' ? null : body.tenantId, body.name, body.email, await hashPassword(password)],
    );
    return reply.status(201).send({ user: toManagedUser(await getUser(rows[0].id)), temporaryPassword: password });
  });

  app.patch('/users/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    const body = z
      .object({
        name: z.string().trim().max(120).optional(),
        role: z.enum(['platform_admin', 'tenant_admin', 'customer']).optional(),
        tenantId: uuid.nullish(),
      })
      .parse(request.body);
    const current = await getUser(id);

    const role = body.role ?? current.role;
    const tenantId = role === 'platform_admin' ? null : body.tenantId !== undefined ? body.tenantId : current.tenant_id;
    const changingAccess = role !== current.role || tenantId !== current.tenant_id;

    if (id === request.auth!.id && changingAccess) {
      throw badRequest('Você não pode mudar o próprio papel ou franquia.');
    }
    if (role !== 'platform_admin') {
      if (!tenantId) throw badRequest('Escolha a franquia.');
      await assertTenantExists(tenantId);
    }
    if (role === 'customer' && !current.cpf) throw badRequest('Cliente do app precisa de CPF cadastrado.');
    if (role !== 'customer' && !current.email) throw badRequest('Acesso ao painel precisa de e-mail.');

    await db.query('update users set name = $2, role = $3, tenant_id = $4 where id = $1', [
      id,
      body.name ?? current.name,
      role,
      tenantId,
    ]);
    // Mudou o que a pessoa pode acessar: força login de novo.
    if (changingAccess) await revokeUserSessions(db, id);
    return toManagedUser(await getUser(id));
  });

  app.post('/users/:id/reset-password', async (request) => {
    const { id } = idParams.parse(request.params);
    await getUser(id);
    const password = temporaryPassword();
    await db.query('update users set password_hash = $2, must_change_password = true where id = $1', [
      id,
      await hashPassword(password),
    ]);
    await revokeUserSessions(db, id);
    return { temporaryPassword: password };
  });

  app.post('/users/:id/disable', async (request) => {
    const { id } = idParams.parse(request.params);
    const { disabled } = z.object({ disabled: z.boolean() }).parse(request.body);
    if (id === request.auth!.id) throw badRequest('Você não pode bloquear a própria conta.');
    await getUser(id);
    await db.query('update users set disabled_at = $2 where id = $1', [id, disabled ? new Date() : null]);
    if (disabled) await revokeUserSessions(db, id);
    return toManagedUser(await getUser(id));
  });
}
