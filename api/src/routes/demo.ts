import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Deps } from '../app.js';
import { requireAuth, assertTenantAccess } from '../auth/session.js';
import { badRequest, notFound } from '../errors.js';
import { DEMO_TENANT, DEMO_PRODUCTS, DEMO_CPF, DEMO_CUSTOMER_PASSWORD, seedDemo } from '../demo.js';

export async function demoRoutes(app: FastifyInstance, { db, config }: Deps) {
  const customer = requireAuth(db, config.JWT_SECRET, ['customer']);
  const admin = requireAuth(db, config.JWT_SECRET, ['tenant_admin', 'platform_admin']);
  async function allowed(tenantId: string) {
    const row = (await db.query('select is_demo from tenants where id=$1', [tenantId])).rows[0];
    if (!config.DEMO_ENABLED || tenantId !== DEMO_TENANT || !row?.is_demo)
      throw notFound('Demonstração indisponível nesta loja.');
  }
  app.get('/public/demo', async (request) => {
    const headers = z.object({ 'x-tenant-id': z.guid() }).parse(request.headers);
    const row = (
      await db.query('select is_demo from tenants where id=$1', [headers['x-tenant-id']])
    ).rows[0];
    if (!row?.is_demo) return { enabled: false, toolsEnabled: false };
    return {
      enabled: true,
      toolsEnabled: config.DEMO_ENABLED,
      products: DEMO_PRODUCTS,
      meatLabel: '2000100019603',
      customerCpf: DEMO_CPF,
      customerPassword: DEMO_CUSTOMER_PASSWORD,
    };
  });
  const key = z
    .string()
    .min(10)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/);
  app.post('/demo/checkout', { preHandler: customer }, async (request, reply) => {
    const user = request.auth!;
    await allowed(user.tenantId!);
    const body = z
      .object({
        requestKey: key,
        items: z
          .array(
            z.object({
              barcode: z.string().min(1).max(64),
              quantity: z.number().positive().max(10000),
            }),
          )
          .min(1)
          .max(200),
        originalTotal: z.number().nonnegative().max(1000000),
        finalTotal: z.number().nonnegative().max(1000000),
      })
      .parse(request.body);
    if (body.finalTotal > body.originalTotal) throw badRequest('Resumo inválido.');
    const rows = (
      await db.query(
        'select barcode from products where tenant_id=$1 and active and barcode=any($2::text[])',
        [DEMO_TENANT, body.items.map((i) => i.barcode)],
      )
    ).rows;
    if (body.items.some((i) => !rows.some((p) => p.barcode === i.barcode)))
      throw badRequest('Produto fora do catálogo de demonstração.');
    const result = await db.query(
      `insert into demo_checkouts(tenant_id,user_id,request_key,summary) values($1,$2,$3,$4::jsonb)
   on conflict(user_id,request_key) do update set request_key=excluded.request_key returning id,summary`,
      [DEMO_TENANT, user.id, body.requestKey, JSON.stringify(body)],
    );
    return reply.status(201).send({
      id: result.rows[0].id,
      summary: result.rows[0].summary,
      simulated: true,
      paymentProcessed: false,
      pointsGranted: false,
    });
  });
  app.post('/demo/notification', { preHandler: customer }, async (request) => {
    const user = request.auth!;
    await allowed(user.tenantId!);
    const { requestKey } = z.object({ requestKey: key }).parse(request.body);
    const offer = (
      await db.query(
        "select id from promotions where tenant_id=$1 and audience='club' and active order by id limit 1",
        [DEMO_TENANT],
      )
    ).rows[0];
    if (!offer) throw badRequest('Crie uma oferta para demonstrar o aviso.');
    await db.query(
      `insert into customer_notifications(tenant_id,user_id,kind,dedupe_key,title,body,offer_id,rule_version)
   values($1,$2,'offer',$3,'Simulação: oferta para você','Arroz com desconto no clube. Este aviso é fictício e não foi enviado por push.',$4,'demo-preview') on conflict(user_id,dedupe_key) do nothing`,
      [DEMO_TENANT, user.id, requestKey, offer.id],
    );
    return { simulated: true, pushSent: false };
  });
  app.post('/admin/tenants/:tenantId/demo/reset', { preHandler: admin }, async (request) => {
    const { tenantId } = z.object({ tenantId: z.guid() }).parse(request.params);
    assertTenantAccess(request.auth!, tenantId);
    await allowed(tenantId);
    const { confirmation } = z
      .object({ confirmation: z.literal('RESTAURAR DEMONSTRACAO') })
      .parse(request.body);
    if (confirmation && !config.DEMO_OWNER_PASSWORD)
      throw badRequest('Demonstração não configurada.');
    await seedDemo(db, config.DEMO_OWNER_PASSWORD!, true);
    return { ok: true, customerMustLoginAgain: true };
  });
}
