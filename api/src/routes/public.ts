// Rotas do app do cliente sem login. A franquia vem do header x-tenant-id
// (cada build do app representa uma franquia) e TODA consulta filtra por ela.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { Deps } from '../app.js';
import { notFound } from '../errors.js';
import {
  toAppProduct,
  toSettings,
  type ProductRow,
  type PromotionRow,
  type SettingsRow,
  type TenantRow,
} from '../mappers.js';
import { normalizePlu, tenantIdHeader } from '../validation.js';

export async function publicRoutes(app: FastifyInstance, { db }: Deps) {
  async function requestTenant(request: FastifyRequest): Promise<TenantRow> {
    const { 'x-tenant-id': tenantId } = tenantIdHeader.parse(request.headers);
    const { rows } = await db.query<TenantRow>('select * from tenants where id = $1', [tenantId]);
    if (!rows[0]) throw notFound('Franquia não encontrada.');
    return rows[0];
  }

  async function findProduct(tenantId: string, column: 'barcode' | 'plu', code: string) {
    const { rows } = await db.query<ProductRow>(
      `select * from products where tenant_id = $1 and ${column} = $2 and active`,
      [tenantId, code],
    );
    const product = rows[0];
    if (!product) throw notFound('Produto não cadastrado.');

    const promotions = await db.query<PromotionRow>(
      `select kind, label, percent, buy_qty, pay_qty, fixed_price
       from promotions
       where product_id = $1 and active and starts_at <= now() and (ends_at is null or ends_at > now())
       order by starts_at desc
       limit 1`,
      [product.id],
    );
    return toAppProduct(product, promotions.rows[0] ?? null);
  }

  /** Nome, cor e logo da franquia — só isso (plano/território ficam de fora). */
  app.get('/brand', async (request) => {
    const tenant = await requestTenant(request);
    return { name: tenant.name, accentColor: tenant.accent_color, logoUrl: tenant.logo_url };
  });

  app.get('/settings', async (request) => {
    const tenant = await requestTenant(request);
    const { rows } = await db.query<SettingsRow>('select * from tenant_settings where tenant_id = $1', [tenant.id]);
    if (!rows[0]) throw notFound('Configuração da franquia não encontrada.');
    return toSettings(rows[0]);
  });

  app.get('/products/barcode/:code', async (request) => {
    const tenant = await requestTenant(request);
    const { code } = z.object({ code: z.string().regex(/^[0-9]{6,14}$/) }).parse(request.params);
    return findProduct(tenant.id, 'barcode', code);
  });

  app.get('/products/plu/:plu', async (request) => {
    const tenant = await requestTenant(request);
    const { plu } = z.object({ plu: z.string().regex(/^[0-9]{1,6}$/) }).parse(request.params);
    return findProduct(tenant.id, 'plu', normalizePlu(plu));
  });
}
