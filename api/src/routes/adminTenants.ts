// Painel admin: franquias, configurações (balança/regras) e produtos.
// platform_admin acessa tudo; tenant_admin só a própria franquia.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { Deps } from '../app.js';
import { assertTenantAccess, requireAuth, type AuthUser } from '../auth/session.js';
import { forbidden, notFound } from '../errors.js';
import {
  toAdminProduct,
  toSettings,
  toTenant,
  type ProductRow,
  type SettingsRow,
  type TenantRow,
} from '../mappers.js';
import { hexColor, idParams, normalizePlu, productBody, settingsBody } from '../validation.js';

const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífen (ex.: mercado-bom-preco).');
const plan = z.enum(['padrao', 'pro', 'enterprise']);
const status = z.enum(['ativa', 'em_configuracao', 'suspensa']);
const logoUrl = z
  .string()
  .trim()
  .url('URL do logo inválida.')
  .refine((value) => /^https?:\/\//i.test(value), 'O logo precisa de um endereço http(s).')
  .nullable()
  .or(z.literal('').transform(() => null));

// Campos comerciais: só a plataforma altera.
const COMMERCIAL_FIELDS = ['slug', 'plan', 'status', 'exclusivityRegion'] as const;

export async function adminTenantRoutes(app: FastifyInstance, { db, config }: Deps) {
  app.addHook('preHandler', requireAuth(db, config.JWT_SECRET, ['platform_admin', 'tenant_admin']));

  async function getTenant(id: string): Promise<TenantRow> {
    const { rows } = await db.query<TenantRow>('select * from tenants where id = $1', [id]);
    if (!rows[0]) throw notFound('Franquia não encontrada.');
    return rows[0];
  }

  // ---------------- Franquias ----------------

  app.get('/tenants', async (request) => {
    const user = request.auth!;
    const { rows } =
      user.role === 'platform_admin'
        ? await db.query<TenantRow>('select * from tenants order by name')
        : await db.query<TenantRow>('select * from tenants where id = $1', [user.tenantId]);
    return rows.map(toTenant);
  });

  app.post('/tenants', async (request, reply) => {
    if (request.auth!.role !== 'platform_admin') throw forbidden('Só a equipe da plataforma cria franquias.');
    const body = z
      .object({
        name: z.string().trim().min(1, 'Informe o nome.'),
        slug,
        plan: plan.default('padrao'),
        accentColor: hexColor.default('#1DB954'),
      })
      .parse(request.body);
    const { rows } = await db.query<TenantRow>(
      `insert into tenants (name, slug, plan, accent_color) values ($1, $2, $3, $4) returning *`,
      [body.name, body.slug, body.plan, body.accentColor],
    );
    return reply.status(201).send(toTenant(rows[0]));
  });

  app.get('/tenants/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    return toTenant(await getTenant(id));
  });

  app.patch('/tenants/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    const user = request.auth!;
    assertTenantAccess(user, id);
    const body = z
      .object({
        name: z.string().trim().min(1, 'Informe o nome.').optional(),
        accentColor: hexColor.optional(),
        logoUrl: logoUrl.optional(),
        slug: slug.optional(),
        plan: plan.optional(),
        status: status.optional(),
        exclusivityRegion: z.string().trim().nullable().optional(),
      })
      .parse(request.body);

    if (user.role !== 'platform_admin' && COMMERCIAL_FIELDS.some((field) => body[field] !== undefined)) {
      throw forbidden('Somente a equipe da plataforma altera slug, plano, status ou território.');
    }

    const columns: Record<string, unknown> = {
      name: body.name,
      accent_color: body.accentColor?.toUpperCase(),
      logo_url: body.logoUrl,
      slug: body.slug,
      plan: body.plan,
      status: body.status,
      exclusivity_region: body.exclusivityRegion === '' ? null : body.exclusivityRegion,
    };
    const entries = Object.entries(columns).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return toTenant(await getTenant(id));

    const assignments = entries.map(([column], index) => `${column} = $${index + 2}`).join(', ');
    const { rows } = await db.query<TenantRow>(
      `update tenants set ${assignments} where id = $1 returning *`,
      [id, ...entries.map(([, value]) => value)],
    );
    if (!rows[0]) throw notFound('Franquia não encontrada.');
    return toTenant(rows[0]);
  });

  // ---------------- Configurações (balança + regras) ----------------

  app.get('/tenants/:id/settings', async (request) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    const { rows } = await db.query<SettingsRow>('select * from tenant_settings where tenant_id = $1', [id]);
    if (!rows[0]) throw notFound('Franquia não encontrada.');
    return toSettings(rows[0]);
  });

  app.put('/tenants/:id/settings', async (request) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    const body = settingsBody.parse(request.body);
    await getTenant(id);
    const { rows } = await db.query<SettingsRow>(
      `insert into tenant_settings (
         tenant_id, scale_enabled, scale_prefix, scale_plu_length, scale_value_type, scale_value_length,
         scale_value_decimals, scale_validate_check_digit, budget_warning_percent, scan_cooldown_ms
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (tenant_id) do update set
         scale_enabled = excluded.scale_enabled,
         scale_prefix = excluded.scale_prefix,
         scale_plu_length = excluded.scale_plu_length,
         scale_value_type = excluded.scale_value_type,
         scale_value_length = excluded.scale_value_length,
         scale_value_decimals = excluded.scale_value_decimals,
         scale_validate_check_digit = excluded.scale_validate_check_digit,
         budget_warning_percent = excluded.budget_warning_percent,
         scan_cooldown_ms = excluded.scan_cooldown_ms
       returning *`,
      [
        id,
        body.scale.enabled,
        body.scale.prefix,
        body.scale.pluLength,
        body.scale.valueType,
        body.scale.valueLength,
        body.scale.valueDecimals,
        body.scale.validateCheckDigit,
        body.budgetWarningPercent,
        body.scanCooldownMs,
      ],
    );
    return toSettings(rows[0]);
  });

  // ---------------- Produtos ----------------

  app.get('/tenants/:id/products', async (request) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    const { search = '' } = z.object({ search: z.string().max(100).optional() }).parse(request.query);
    const term = search.trim();
    const { rows } = await db.query<ProductRow>(
      `select * from products
       where tenant_id = $1
         and ($2 = '' or name ilike $3 or barcode like $3 or plu = $4)
       order by lower(name)
       limit 200`,
      [id, term, `%${term.replace(/[\\%_]/g, '\\$&')}%`, normalizePlu(term) || null],
    );
    return rows.map(toAdminProduct);
  });

  app.get('/tenants/:id/products/plu/:plu', async (request, reply) => {
    const { id, plu } = z.object({ id: idParams.shape.id, plu: z.string().regex(/^[0-9]{1,6}$/) }).parse(request.params);
    assertTenantAccess(request.auth!, id);
    const { rows } = await db.query<ProductRow>('select * from products where tenant_id = $1 and plu = $2', [
      id,
      normalizePlu(plu),
    ]);
    if (!rows[0]) return reply.status(404).send({ error: 'Nenhum produto com esse PLU nesta franquia.' });
    return toAdminProduct(rows[0]);
  });

  app.post('/tenants/:id/products', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    const body = productBody.parse(request.body);
    await getTenant(id);
    const { rows } = await db.query<ProductRow>(
      `insert into products (tenant_id, barcode, plu, name, price, unit, category, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [id, body.barcode, body.plu, body.name, body.price, body.unit, body.category, body.active],
    );
    return reply.status(201).send(toAdminProduct(rows[0]));
  });

  async function getProduct(productId: string, user: AuthUser) {
    const { rows } = await db.query<ProductRow>('select * from products where id = $1', [productId]);
    if (!rows[0]) throw notFound('Produto não encontrado.');
    assertTenantAccess(user, rows[0].tenant_id);
    return rows[0];
  }

  app.get('/products/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    return toAdminProduct(await getProduct(id, request.auth!));
  });

  app.put('/products/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    await getProduct(id, request.auth!);
    const body = productBody.parse(request.body);
    const { rows } = await db.query<ProductRow>(
      `update products set barcode = $2, plu = $3, name = $4, price = $5, unit = $6, category = $7, active = $8
       where id = $1 returning *`,
      [id, body.barcode, body.plu, body.name, body.price, body.unit, body.category, body.active],
    );
    return toAdminProduct(rows[0]);
  });
}
