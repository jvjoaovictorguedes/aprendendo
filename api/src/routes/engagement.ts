import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Deps } from '../app.js';
import { requireAuth } from '../auth/session.js';
import { transaction } from '../db/pool.js';
import { badRequest, notFound } from '../errors.js';

const key = z
  .string()
  .min(10)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const itemsSchema = z
  .array(
    z.object({
      barcode: z.string().min(1).max(64),
      quantity: z.number().positive().max(10000).multipleOf(0.001),
    }),
  )
  .max(200);

export async function engagementRoutes(app: FastifyInstance, { db, config }: Deps) {
  app.addHook('preHandler', requireAuth(db, config.JWT_SECRET, ['customer']));

  async function validateStore(tenantId: string, storeId: string | null) {
    if (!storeId) return;
    const result = await db.query('select id from stores where tenant_id=$1 and id=$2 and active', [
      tenantId,
      storeId,
    ]);
    if (!result.rows.length) throw badRequest('Loja indisponível nesta franquia.');
  }
  async function resolveItems(tenantId: string, items: z.infer<typeof itemsSchema>) {
    if (!items.length) return [];
    const { rows } = await db.query<{ id: string; barcode: string | null; plu: string | null }>(
      "select id,barcode,plu from products where tenant_id=$1 and active and (barcode=any($2::text[]) or ('plu:'||plu)=any($2::text[]))",
      [tenantId, items.map((i) => i.barcode)],
    );
    const totals = new Map<string, number>();
    for (const item of items) {
      const product = rows.find(
        (p) => p.barcode === item.barcode || `plu:${p.plu}` === item.barcode,
      );
      if (!product)
        throw badRequest('Há um produto indisponível nesta franquia. Atualize o carrinho.');
      totals.set(product.id, (totals.get(product.id) ?? 0) + item.quantity);
    }
    return Array.from(totals, ([productId, quantity]) => ({ productId, quantity }));
  }
  app.get('/preferences', async (request) => {
    const { rows } = await db.query(
      'select cart_reminders,personalized_offers from notification_preferences where user_id=$1 and tenant_id=$2',
      [request.auth!.id, request.auth!.tenantId],
    );
    return {
      cartReminders: rows[0]?.cart_reminders ?? false,
      personalizedOffers: rows[0]?.personalized_offers ?? false,
    };
  });
  app.put('/preferences', async (request) => {
    const body = z
      .object({ cartReminders: z.boolean(), personalizedOffers: z.boolean() })
      .parse(request.body);
    const user = request.auth!;
    await db.query(
      `insert into notification_preferences(user_id,tenant_id,cart_reminders,personalized_offers)
      values($1,$2,$3,$4) on conflict(user_id) do update set cart_reminders=$3,personalized_offers=$4,updated_at=now()`,
      [user.id, user.tenantId, body.cartReminders, body.personalizedOffers],
    );
    // A fila será conferida novamente antes do envio; cancela os tipos desligados agora.
    await db.query(
      `update push_deliveries d set status='cancelled' from customer_notifications n
      where d.notification_id=n.id and n.user_id=$1 and d.status='pending'
      and ((n.kind='cart' and not $2) or (n.kind='offer' and not $3))`,
      [user.id, body.cartReminders, body.personalizedOffers],
    );
    return body;
  });
  app.put('/devices', async (request) => {
    const body = z
      .object({
        installationId: key,
        token: z
          .string()
          .regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)
          .max(250),
        platform: z.enum(['android', 'ios']),
      })
      .parse(request.body);
    const user = request.auth!;
    // Uma instalação pode trocar de conta; o antigo usuário deixa de receber nela.
    await transaction(db, async (client) => {
      await client.query(
        'delete from push_devices where (installation_id=$1 or token=$2) and user_id<>$3',
        [body.installationId, body.token, user.id],
      );
      await client.query('delete from push_devices where token=$1 and installation_id<>$2', [
        body.token,
        body.installationId,
      ]);
      await client.query(
        `insert into push_devices(user_id,tenant_id,session_id,installation_id,token,platform)
        values($1,$2,$3,$4,$5,$6) on conflict(user_id,installation_id) do update
        set session_id=$3,token=$5,platform=$6,active=true,updated_at=now()`,
        [user.id, user.tenantId, user.sessionId, body.installationId, body.token, body.platform],
      );
    });
    return { ok: true };
  });
  app.delete('/devices/:installationId', async (request) => {
    const { installationId } = z.object({ installationId: key }).parse(request.params);
    await db.query('update push_devices set active=false where user_id=$1 and installation_id=$2', [
      request.auth!.id,
      installationId,
    ]);
    return { ok: true };
  });
  app.put('/cart', async (request) => {
    const body = z
      .object({
        cartKey: key,
        revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        storeId: z.uuid().nullable(),
        items: itemsSchema,
      })
      .parse(request.body);
    const user = request.auth!;
    await validateStore(user.tenantId!, body.storeId);
    const items = await resolveItems(user.tenantId!, body.items);
    await db.query(
      `insert into customer_carts(user_id,tenant_id,store_id,cart_key,revision,items,status)
      values($1,$2,$3,$4,$5,$6::jsonb,$7) on conflict(user_id) do update
      set store_id=$3,cart_key=$4,revision=$5,items=$6::jsonb,status=$7,last_activity_at=now()
      where customer_carts.revision<$5 and not (customer_carts.cart_key=$4 and customer_carts.status='closed')`,
      [
        user.id,
        user.tenantId,
        body.storeId,
        body.cartKey,
        body.revision,
        JSON.stringify(items),
        items.length ? 'active' : 'closed',
      ],
    );
    return { ok: true };
  });
  app.post('/purchases', async (request, reply) => {
    const body = z
      .object({
        requestKey: key,
        cartKey: key,
        storeId: z.uuid().nullable(),
        items: itemsSchema.min(1),
      })
      .parse(request.body);
    const user = request.auth!;
    const previous = await db.query(
      'select id,source from customer_purchases where user_id=$1 and (request_key=$2 or cart_key=$3)',
      [user.id, body.requestKey, body.cartKey],
    );
    if (previous.rows[0]) return previous.rows[0];
    await validateStore(user.tenantId!, body.storeId);
    const items = await resolveItems(user.tenantId!, body.items);
    const purchase = await transaction(db, async (client) => {
      // Serializa confirmações concorrentes do mesmo usuário.
      await client.query('select id from users where id=$1 for update', [user.id]);
      const existing = await client.query(
        'select id,source from customer_purchases where user_id=$1 and (request_key=$2 or cart_key=$3)',
        [user.id, body.requestKey, body.cartKey],
      );
      if (existing.rows[0]) return existing.rows[0];
      const result = await client.query(
        `insert into customer_purchases(user_id,tenant_id,store_id,request_key,cart_key)
        values($1,$2,$3,$4,$5) returning id,source`,
        [user.id, user.tenantId, body.storeId, body.requestKey, body.cartKey],
      );
      for (const item of items)
        await client.query(
          `insert into customer_purchase_items(purchase_id,tenant_id,product_id,quantity)
        values($1,$2,$3,$4)`,
          [result.rows[0].id, user.tenantId, item.productId, item.quantity],
        );
      await client.query(
        `update customer_carts set status='closed' where user_id=$1 and cart_key=$2`,
        [user.id, body.cartKey],
      );
      return result.rows[0];
    });
    return reply.status(201).send(purchase);
  });
  app.get('/notifications', async (request) => {
    const { rows } = await db.query(
      `select id,title,body,kind,created_at,read_at,offer_id,cart_key from customer_notifications
      where user_id=$1 and tenant_id=$2 order by created_at desc limit 100`,
      [request.auth!.id, request.auth!.tenantId],
    );
    return rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      kind: n.kind === 'offer' ? 'coupon' : 'system',
      createdAt: n.created_at,
      read: !!n.read_at,
      target: n.kind === 'cart' ? 'cart' : 'promotions',
      offerId: n.offer_id,
    }));
  });
  app.post('/notifications/:id/read', async (request) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const { opened } = z.object({ opened: z.boolean().default(false) }).parse(request.body ?? {});
    const result = await db.query(
      `update customer_notifications set read_at=coalesce(read_at,now()),
      opened_at=case when $3 then coalesce(opened_at,now()) else opened_at end
      where id=$1 and user_id=$2 returning id`,
      [id, request.auth!.id, opened],
    );
    if (!result.rows.length) throw notFound('Notificação não encontrada.');
    return { ok: true };
  });
}
