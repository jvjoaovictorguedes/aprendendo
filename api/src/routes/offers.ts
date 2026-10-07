import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Deps } from '../app.js';
import { requireAuth, assertTenantAccess } from '../auth/session.js';
import { transaction } from '../db/pool.js';
import { badRequest, notFound, conflict } from '../errors.js';
import type { ProductRow } from '../mappers.js';
import { offerBody, storeBody, loyaltyBody, toLoyalty, toOffer, type OfferRow } from '../offers.js';
import { idParams, tenantIdHeader, uuid } from '../validation.js';

export async function offerRoutes(app: FastifyInstance, { db, config }: Deps) {
  const admin = requireAuth(db, config.JWT_SECRET, ['platform_admin', 'tenant_admin']);
  const customer = requireAuth(db, config.JWT_SECRET, ['customer']);
  async function tenant(request: FastifyRequest) {
    const { 'x-tenant-id': id } = tenantIdHeader.parse(request.headers);
    const r = await db.query('select id from tenants where id=$1', [id]);
    if (!r.rows[0]) throw notFound('Franquia não encontrada.');
    return id;
  }
  async function getOffers(tenantId: string, publicOnly: boolean, storeId?: string | null) {
    const { rows } = await db.query<OfferRow & { product: ProductRow }>(
      `select p.*, s.name as store_name, row_to_json(prod) as product from promotions p
    join products prod on prod.id=p.product_id and prod.tenant_id=p.tenant_id
    left join stores s on s.id=p.store_id and s.tenant_id=p.tenant_id
    where p.tenant_id=$1 and (not $2 or (p.active and prod.active and p.starts_at<=now()
      and (p.ends_at is null or p.ends_at>now()) and (p.store_id is null or (s.active and p.store_id=$3))))
    order by p.starts_at desc, p.id desc`,
      [tenantId, publicOnly, storeId ?? null],
    );
    const offers = rows.map((r) => toOffer(r, { ...r.product, price: Number(r.product.price) }));
    if (!publicOnly) return offers;
    // One effective general offer per product, exactly as in the scanner lookup.
    const seen = new Set<string>();
    return offers.filter((o) => {
      if (o.audience === 'club') return true;
      if (seen.has(o.productId)) return false;
      seen.add(o.productId);
      return true;
    });
  }
  app.get('/public/offers', async (request) => {
    const id = await tenant(request);
    const { storeId } = z.object({ storeId: uuid.optional() }).parse(request.query);
    return getOffers(id, true, storeId);
  });
  app.get('/public/stores', async (request) => {
    const id = await tenant(request);
    return (
      await db.query(
        'select id, name, address, hours, active from stores where tenant_id=$1 and active order by name',
        [id],
      )
    ).rows;
  });
  app.get('/public/loyalty', async (request) => {
    const id = await tenant(request);
    return toLoyalty(
      (await db.query('select * from loyalty_settings where tenant_id=$1', [id])).rows[0],
    );
  });
  app.get('/admin/tenants/:id/offers', { preHandler: admin }, async (request) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    return getOffers(id, false);
  });
  async function saveOffer(request: FastifyRequest, editing: boolean) {
    const params = z.object({ id: uuid, offerId: uuid.optional() }).parse(request.params);
    assertTenantAccess(request.auth!, params.id);
    const b = offerBody.parse(request.body);
    const product = (
      await db.query<ProductRow>('select * from products where id=$1 and tenant_id=$2', [
        b.productId,
        params.id,
      ])
    ).rows[0];
    if (!product) throw badRequest('Selecione um produto desta franquia.');
    if (
      b.storeId &&
      !(
        await db.query('select id from stores where id=$1 and tenant_id=$2 and active', [
          b.storeId,
          params.id,
        ])
      ).rows[0]
    )
      throw badRequest('Selecione uma loja ativa desta franquia.');
    if (b.kind === 'fixed_price' && b.price! > Number(product.price))
      throw badRequest('O preço promocional não pode superar o preço normal.');
    if (b.kind === 'buy_x_pay_y' && product.unit === 'kg')
      throw badRequest('Leve e pague só vale para produtos por unidade.');
    if (product.unit === 'un' && b.maxQuantity !== null && !Number.isInteger(b.maxQuantity))
      throw badRequest('O limite por unidade deve ser inteiro.');
    const values = [
      params.id,
      b.productId,
      b.label,
      b.kind,
      b.kind === 'percent_off' ? b.percent : null,
      b.kind === 'buy_x_pay_y' ? b.buy : null,
      b.kind === 'buy_x_pay_y' ? b.pay : null,
      b.kind === 'fixed_price' ? b.price : null,
      b.audience,
      b.storeId,
      b.startsAt,
      b.endsAt,
      b.maxQuantity,
      b.conditions,
      b.active,
    ];
    const query = editing
      ? `update promotions set product_id=$2,label=$3,kind=$4,percent=$5,buy_qty=$6,pay_qty=$7,fixed_price=$8,
   audience=$9,store_id=$10,starts_at=$11,ends_at=$12,max_quantity=$13,conditions=$14,active=$15 where tenant_id=$1 and id=$16 returning id`
      : `insert into promotions (tenant_id,product_id,label,kind,percent,buy_qty,pay_qty,fixed_price,audience,store_id,starts_at,ends_at,max_quantity,conditions,active)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`;
    const result = await db.query(query, editing ? [...values, params.offerId] : values);
    if (!result.rows[0]) throw notFound('Oferta não encontrada.');
    return (await getOffers(params.id, false)).find((o) => o.id === result.rows[0].id)!;
  }
  app.post('/admin/tenants/:id/offers', { preHandler: admin }, async (request, reply) =>
    reply.status(201).send(await saveOffer(request, false)),
  );
  app.put('/admin/tenants/:id/offers/:offerId', { preHandler: admin }, (request) =>
    saveOffer(request, true),
  );
  app.delete('/admin/tenants/:id/offers/:offerId', { preHandler: admin }, async (request) => {
    const { id, offerId } = z.object({ id: uuid, offerId: uuid }).parse(request.params);
    assertTenantAccess(request.auth!, id);
    const r = await db.query(
      'update promotions set active=false where tenant_id=$1 and id=$2 returning id',
      [id, offerId],
    );
    if (!r.rows[0]) throw notFound('Oferta não encontrada.');
    return { ok: true };
  });
  app.get('/admin/tenants/:id/stores', { preHandler: admin }, async (request) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    return (
      await db.query(
        'select id,name,address,hours,active from stores where tenant_id=$1 order by name',
        [id],
      )
    ).rows;
  });
  app.post('/admin/tenants/:id/stores', { preHandler: admin }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    const b = storeBody.parse(request.body);
    const r = await db.query(
      'insert into stores (tenant_id,name,address,hours,active) values ($1,$2,$3,$4,$5) returning id,name,address,hours,active',
      [id, b.name, b.address, b.hours, b.active],
    );
    return reply.status(201).send(r.rows[0]);
  });
  app.put('/admin/tenants/:id/stores/:storeId', { preHandler: admin }, async (request) => {
    const { id, storeId } = z.object({ id: uuid, storeId: uuid }).parse(request.params);
    assertTenantAccess(request.auth!, id);
    const b = storeBody.parse(request.body);
    const r = await db.query(
      'update stores set name=$3,address=$4,hours=$5,active=$6 where tenant_id=$1 and id=$2 returning id,name,address,hours,active',
      [id, storeId, b.name, b.address, b.hours, b.active],
    );
    if (!r.rows[0]) throw notFound('Loja não encontrada.');
    return r.rows[0];
  });
  app.get('/admin/tenants/:id/loyalty', { preHandler: admin }, async (request) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    return toLoyalty(
      (await db.query('select * from loyalty_settings where tenant_id=$1', [id])).rows[0],
    );
  });
  app.put('/admin/tenants/:id/loyalty', { preHandler: admin }, async (request) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    const b = loyaltyBody.parse(request.body);
    const r = await db.query(
      `insert into loyalty_settings (tenant_id,enabled,reward_name,points_required,conditions,points_per_real) values ($1,$2,$3,$4,$5,$6)
    on conflict(tenant_id) do update set enabled=$2,reward_name=$3,points_required=$4,conditions=$5,points_per_real=$6 returning *`,
      [id, b.enabled, b.rewardName, b.pointsRequired, b.conditions, b.pointsPerReal],
    );
    return toLoyalty(r.rows[0]);
  });
  app.post('/admin/tenants/:id/loyalty/credits', { preHandler: admin }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    const body = z
      .object({
        cpf: z.string().regex(/^[0-9]{11}$/),
        receipt: z.string().trim().min(1).max(120),
        total: z.number().gt(0).max(99999999).multipleOf(0.01),
      })
      .parse(request.body);
    const result = await transaction(db, async (client) => {
      const user = (
        await client.query(
          "select id from users where tenant_id=$1 and cpf=$2 and role='customer' and disabled_at is null for update",
          [id, body.cpf],
        )
      ).rows[0];
      if (!user) throw badRequest('Cliente não cadastrado nesta franquia.');
      const rule = (
        await client.query(
          'select points_per_real from loyalty_settings where tenant_id=$1 and enabled for share',
          [id],
        )
      ).rows[0];
      if (!rule) throw badRequest('Ative o programa de fidelidade primeiro.');
      const points = Math.floor(
        (Math.round(body.total * 100) * Math.round(Number(rule.points_per_real) * 100)) / 10000,
      );
      if (points < 1) throw badRequest('O valor da compra não gera um ponto inteiro.');
      const credit = (
        await client.query(
          `insert into loyalty_credits (tenant_id,user_id,credited_by,receipt,purchase_total,points)
    values ($1,$2,$3,$4,$5,$6) on conflict(tenant_id,receipt) do nothing returning id`,
          [id, user.id, request.auth!.id, body.receipt, body.total, points],
        )
      ).rows[0];
      if (!credit) throw conflict('Este comprovante já teve pontos creditados.');
      await client.query('update users set points=points+$2 where id=$1', [user.id, points]);
      return { id: credit.id, points };
    });
    return reply.status(201).send(result);
  });
  app.get('/customer/activations', { preHandler: customer }, async (request) => {
    return (
      await db.query(
        `select a.promotion_id as id from promotion_activations a join promotions p on p.id=a.promotion_id
    where a.user_id=$1 and p.tenant_id=$2 and p.audience='club' and p.active and p.starts_at<=now() and (p.ends_at is null or p.ends_at>now())`,
        [request.auth!.id, request.auth!.tenantId],
      )
    ).rows.map((r) => r.id);
  });
  app.put('/customer/activations/:id', { preHandler: customer }, async (request) => {
    const { id } = idParams.parse(request.params);
    const user = request.auth!;
    const p = (
      await db.query(
        `select id from promotions where id=$1 and tenant_id=$2 and audience='club' and active
   and starts_at<=now() and (ends_at is null or ends_at>now())`,
        [id, user.tenantId],
      )
    ).rows[0];
    if (!p) throw notFound('Oferta indisponível.');
    await db.query(
      'insert into promotion_activations (user_id,promotion_id) values ($1,$2) on conflict do nothing',
      [user.id, id],
    );
    return { ok: true };
  });
  app.delete('/customer/activations/:id', { preHandler: customer }, async (request) => {
    const { id } = idParams.parse(request.params);
    await db.query('delete from promotion_activations where user_id=$1 and promotion_id=$2', [
      request.auth!.id,
      id,
    ]);
    return { ok: true };
  });
  app.get(
    '/customer/rewards',
    { preHandler: customer },
    async (request) =>
      (
        await db.query(
          'select id,reward_name as "rewardName",points_spent as "pointsSpent",conditions,redeemed_at as "redeemedAt" from loyalty_redemptions where user_id=$1 and tenant_id=$2 order by created_at desc',
          [request.auth!.id, request.auth!.tenantId],
        )
      ).rows,
  );
  app.post('/customer/rewards', { preHandler: customer }, async (request, reply) => {
    const u = request.auth!;
    const { requestKey } = z
      .object({
        requestKey: z
          .string()
          .min(10)
          .max(100)
          .regex(/^[a-zA-Z0-9-]+$/),
      })
      .parse(request.body);
    const result = await transaction(db, async (client) => {
      const user = (await client.query('select points from users where id=$1 for update', [u.id]))
        .rows[0];
      const existing = (
        await client.query(
          'select id,reward_name as "rewardName",points_spent as "pointsSpent",conditions,redeemed_at as "redeemedAt" from loyalty_redemptions where user_id=$1 and request_key=$2',
          [u.id, requestKey],
        )
      ).rows[0];
      if (existing) return existing;
      const rule = (
        await client.query(
          'select * from loyalty_settings where tenant_id=$1 and enabled for share',
          [u.tenantId],
        )
      ).rows[0];
      if (!rule) throw badRequest('O programa de benefícios não está disponível.');
      if (user.points < rule.points_required)
        throw badRequest('Pontos insuficientes para este benefício.');
      await client.query('update users set points=points-$2 where id=$1', [
        u.id,
        rule.points_required,
      ]);
      return (
        await client.query(
          `insert into loyalty_redemptions (tenant_id,user_id,reward_name,points_spent,conditions,request_key) values ($1,$2,$3,$4,$5,$6)
     returning id,reward_name as "rewardName",points_spent as "pointsSpent",conditions,redeemed_at as "redeemedAt"`,
          [u.tenantId, u.id, rule.reward_name, rule.points_required, rule.conditions, requestKey],
        )
      ).rows[0];
    });
    return reply.status(201).send(result);
  });
  app.get('/admin/tenants/:id/rewards', { preHandler: admin }, async (request) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    return (
      await db.query(
        `select r.id,r.reward_name as "rewardName",r.points_spent as "pointsSpent",r.conditions,r.redeemed_at as "redeemedAt",u.name as "customerName"
    from loyalty_redemptions r join users u on u.id=r.user_id where r.tenant_id=$1 order by r.created_at desc limit 200`,
        [id],
      )
    ).rows;
  });
  app.post(
    '/admin/tenants/:id/rewards/:rewardId/redeem',
    { preHandler: admin },
    async (request) => {
      const { id, rewardId } = z.object({ id: uuid, rewardId: uuid }).parse(request.params);
      assertTenantAccess(request.auth!, id);
      const r = await db.query(
        'update loyalty_redemptions set redeemed_at=now(),redeemed_by=$3 where tenant_id=$1 and id=$2 and redeemed_at is null returning id',
        [id, rewardId, request.auth!.id],
      );
      if (!r.rows[0]) throw badRequest('Benefício não encontrado ou já utilizado.');
      return { ok: true };
    },
  );
}
