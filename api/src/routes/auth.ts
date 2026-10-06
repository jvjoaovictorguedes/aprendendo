import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { Deps } from '../app.js';
import { hashPassword, verifyPassword, verifyPasswordOrDummy } from '../auth/password.js';
import { createSession, requireAuth, revokeSession, revokeUserSessions, type Role } from '../auth/session.js';
import { badRequest, unauthorized } from '../errors.js';
import { toMe } from '../mappers.js';
import { email, password, tenantIdHeader } from '../validation.js';

type LoginRow = { id: string; role: Role; password_hash: string; disabled_at: Date | null };

export async function authRoutes(app: FastifyInstance, { db, config, limiter }: Deps) {
  const authenticated = requireAuth(db, config.JWT_SECRET);

  async function finishLogin(row: LoginRow | undefined, plainPassword: string, limitKey: string, userAgent?: string) {
    limiter.check(limitKey);
    const ok = await verifyPasswordOrDummy(plainPassword, row?.password_hash);
    if (!row || !ok || row.disabled_at) {
      limiter.registerFailure(limitKey);
      throw unauthorized(row?.disabled_at && ok ? 'Este acesso está bloqueado.' : 'Login ou senha incorretos.');
    }
    limiter.reset(limitKey);
    const token = await createSession(db, {
      userId: row.id,
      secret: config.JWT_SECRET,
      days: config.SESSION_DAYS,
      userAgent,
    });
    return token;
  }

  /** Login do painel admin (equipe da plataforma e admins de franquia). */
  app.post('/login', async (request) => {
    const body = z.object({ email, password: z.string().min(1, 'Informe a senha.') }).parse(request.body);
    const { rows } = await db.query<LoginRow>(
      `select id, role, password_hash, disabled_at from users where email = $1 and role <> 'customer'`,
      [body.email],
    );
    const token = await finishLogin(rows[0], body.password, `admin:${request.ip}:${body.email}`, request.headers['user-agent']);
    const me = await loadMe(rows[0].id);
    return { token, user: me };
  });

  /** Login do cliente no app: CPF + senha, dentro da franquia do app. */
  app.post('/customer/login', async (request) => {
    const { 'x-tenant-id': tenantId } = tenantIdHeader.parse(request.headers);
    const body = z
      .object({
        cpf: z.string().transform((value) => value.replace(/\D/g, '')).pipe(z.string().length(11, 'CPF deve ter 11 dígitos.')),
        password: z.string().min(1, 'Informe a senha.'),
      })
      .parse(request.body);
    const { rows } = await db.query<LoginRow>(
      `select id, role, password_hash, disabled_at from users
       where tenant_id = $1 and cpf = $2 and role = 'customer'`,
      [tenantId, body.cpf],
    );
    const token = await finishLogin(rows[0], body.password, `customer:${request.ip}:${tenantId}:${body.cpf}`, request.headers['user-agent']);
    const me = await loadMe(rows[0].id);
    return { token, user: me };
  });

  async function loadMe(userId: string) {
    const { rows } = await db.query(
      `select id, role, tenant_id, name, email, cpf, points, must_change_password from users where id = $1`,
      [userId],
    );
    const row = rows[0];
    return toMe({
      id: row.id,
      sessionId: '',
      role: row.role,
      tenantId: row.tenant_id,
      name: row.name,
      email: row.email,
      cpf: row.cpf,
      points: row.points,
      mustChangePassword: row.must_change_password,
    });
  }

  app.get('/me', { preHandler: authenticated }, async (request) => toMe(request.auth!));

  app.post('/logout', { preHandler: authenticated }, async (request) => {
    await revokeSession(db, request.auth!.sessionId);
    return { ok: true };
  });

  /** Troca a própria senha (obrigatório depois de receber senha temporária). */
  app.post('/change-password', { preHandler: authenticated }, async (request) => {
    const body = z.object({ currentPassword: z.string().min(1), newPassword: password }).parse(request.body);
    const user = request.auth!;
    const { rows } = await db.query<{ password_hash: string }>('select password_hash from users where id = $1', [user.id]);
    if (!(await verifyPassword(body.currentPassword, rows[0].password_hash))) {
      throw badRequest('A senha atual não confere.');
    }
    if (body.currentPassword === body.newPassword) throw badRequest('A nova senha precisa ser diferente da atual.');

    await db.query('update users set password_hash = $2, must_change_password = false where id = $1', [
      user.id,
      await hashPassword(body.newPassword),
    ]);
    // Outros aparelhos saem; este continua logado.
    await revokeUserSessions(db, user.id, user.sessionId);
    return { ok: true };
  });
}
