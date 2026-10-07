import { loadNotificationPolicy } from './notificationPolicy.js';
import type { Config } from './config.js';
import type { Db } from './db/pool.js';
import { transaction } from './db/pool.js';

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  channelId: string;
  sound: 'default';
  data: {
    notificationId: string;
    target: 'cart' | 'promotions';
    offerId: string | null;
  };
  ttl: number;
};
type PushResult = { status: 'ok'; id?: string } | { status: 'error'; details?: { error?: string } };
export type PushTransport = {
  send: (message: PushMessage) => Promise<PushResult>;
  receipts: (ids: string[]) => Promise<Record<string, PushResult>>;
};

export function expoTransport(accessToken?: string): PushTransport {
  async function post(path: string, body: unknown) {
    const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Expo HTTP ${response.status}`);
    const result = (await response.json()) as {
      data?: unknown;
      errors?: unknown;
    };
    if (result.errors || !result.data) throw new Error('Resposta inválida do serviço de push');
    return result.data;
  }
  return {
    async send(message) {
      const data = (await post('send', message)) as PushResult;
      if (data.status !== 'ok' && data.status !== 'error')
        throw new Error('Ticket de push inválido');
      if (data.status === 'ok' && !data.id) throw new Error('Ticket sem identificador');
      return data;
    },
    async receipts(ids) {
      return (await post('getReceipts', { ids })) as Record<string, PushResult>;
    },
  };
}

export function isNotificationHour(now: Date, timezone: string, startHour = 8, endHour = 22) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  );
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

type Offer = {
  id: string;
  product_id: string;
  name: string;
  label: string;
  audience: string;
  store_id: string | null;
  ends_at: Date | null;
};
type Cart = {
  cart_key: string;
  store_id: string | null;
  items: { productId: string; quantity: number }[];
  last_activity_at: Date;
  status: string;
};

/** Somente descontos reais e vigentes; lojas inativas nunca são anunciadas. */
async function eligibleOffers(
  db: Pick<Db, 'query'>,
  tenantId: string,
  storeId: string | null,
  now: Date,
) {
  const { rows } = await db.query<Offer>(
    `select o.id,o.product_id,o.label,o.audience,o.store_id,o.ends_at,p.name
    from promotions o join products p on p.id=o.product_id and p.tenant_id=o.tenant_id
    left join stores s on s.id=o.store_id and s.tenant_id=o.tenant_id
    where o.tenant_id=$1 and o.active and p.active and o.starts_at<=$3
      and (o.ends_at is null or o.ends_at>$3)
      and (o.store_id is null or (o.store_id=$2 and s.active))
      and ((o.kind='percent_off' and o.percent>0) or (o.kind='fixed_price' and o.fixed_price<p.price)
        or (o.kind='buy_x_pay_y' and o.buy_qty>o.pay_qty))
    order by o.starts_at desc,o.id desc`,
    [tenantId, storeId, now],
  );
  const seen = new Set<string>();
  return rows.filter((o) => {
    if (o.audience === 'club') return true;
    if (seen.has(o.product_id)) return false;
    seen.add(o.product_id);
    return true;
  });
}

function offerText(offer: Offer, timezone: string) {
  const validity = offer.ends_at
    ? ` Válida até ${offer.ends_at.toLocaleDateString('pt-BR', { timeZone: timezone })}.`
    : '';
  return `${offer.name}: ${offer.label}.${offer.audience === 'club' ? ' Ative a oferta do clube no app.' : ''}${validity} Confira condições e limites.`;
}

/** Uma rodada: cap diário por cliente, deduplicação por carrinho/oferta e fila durável. */
export async function runEngagement(
  db: Db,
  config: Config,
  transport: PushTransport = expoTransport(config.EXPO_ACCESS_TOKEN),
  at?: Date,
) {
  const policy = await loadNotificationPolicy(db, config);
  const clock = () => at ?? new Date();
  let now = clock();
  // Recibos também são consultados fora do horário de avisos.
  const tickets = await db.query<{
    id: string;
    ticket_id: string;
    device_id: string;
    ticket_at: Date;
    sent_token: string;
  }>(
    `select id,ticket_id,device_id,ticket_at,sent_token from push_deliveries
    where status='ticket' and next_attempt_at<=$1 order by next_attempt_at limit 100`,
    [now],
  );
  if (tickets.rows.length) {
    const receipts = await transport.receipts(tickets.rows.map((t) => t.ticket_id));
    for (const ticket of tickets.rows) {
      const receipt = receipts[ticket.ticket_id];
      if (!receipt) {
        const expired = now.getTime() - ticket.ticket_at.getTime() > 24 * 3600000;
        await db.query(
          `update push_deliveries set status=$2,error_code=$3,next_attempt_at=$4 where id=$1 and status='ticket'`,
          [
            ticket.id,
            expired ? 'failed' : 'ticket',
            expired ? 'ReceiptTimeout' : null,
            new Date(now.getTime() + 15 * 60000),
          ],
        );
        continue;
      }
      await db.query(
        `update push_deliveries set status=$2,error_code=$3 where id=$1 and status='ticket'`,
        [
          ticket.id,
          receipt.status === 'ok' ? 'delivered' : 'failed',
          receipt.status === 'error' ? (receipt.details?.error ?? 'PushError') : null,
        ],
      );
      if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered')
        await db.query('update push_devices set active=false where id=$1 and token=$2', [
          ticket.device_id,
          ticket.sent_token,
        ]);
    }
  }
  if (
    !policy.enabled ||
    !isNotificationHour(now, policy.timezone, policy.startHour, policy.endHour)
  )
    return;

  await transaction(db, async (client) => {
    // Impede que duas réplicas criem avisos diferentes para o mesmo cliente no mesmo dia.
    await client.query('select pg_advisory_xact_lock(72916412)');
    const { rows: users } = await client.query<{
      user_id: string;
      tenant_id: string;
      cart_reminders: boolean;
      personalized_offers: boolean;
    }>(
      `select pref.* from notification_preferences pref
      join users u on u.id=pref.user_id join tenants t on t.id=pref.tenant_id
      where u.disabled_at is null and u.role='customer' and not t.is_demo and t.status<>'suspensa' and (pref.cart_reminders or pref.personalized_offers)
      and exists(select 1 from push_devices d join sessions s on s.id=d.session_id where d.user_id=u.id
        and d.active and s.revoked_at is null and s.expires_at>$1)
      and not exists(select 1 from customer_notifications n where n.user_id=u.id and n.created_at>$1::timestamptz-($2::int * interval '1 minute'))
      order by pref.last_evaluated_at,pref.user_id limit 200`,
      [now, policy.minimumIntervalMinutes],
    );
    for (const user of users) {
      await client.query(
        'update notification_preferences set last_evaluated_at=$2 where user_id=$1',
        [user.user_id, now],
      );
      const cart = (
        await client.query<Cart>('select * from customer_carts where user_id=$1', [user.user_id])
      ).rows[0];
      let chosen: {
        kind: 'cart' | 'offer';
        dedupe: string;
        title: string;
        body: string;
        offer: Offer | null;
        cartKey: string | null;
      } | null = null;
      if (
        user.cart_reminders &&
        cart?.status === 'active' &&
        cart.items.length &&
        cart.last_activity_at.getTime() <= now.getTime() - policy.cartReminderMinutes * 60000 &&
        cart.last_activity_at.getTime() > now.getTime() - 24 * 3600000
      ) {
        const duplicate = (
          await client.query(
            'select id from customer_notifications where user_id=$1 and dedupe_key=$2',
            [user.user_id, `cart:${cart.cart_key}`],
          )
        ).rows.length;
        if (!duplicate) {
          const offer =
            (await eligibleOffers(client, user.tenant_id, cart.store_id, now)).find((o) =>
              cart.items.some((i) => i.productId === o.product_id),
            ) ?? null;
          chosen = {
            kind: 'cart',
            dedupe: `cart:${cart.cart_key}`,
            title: 'Seu carrinho ficou salvo',
            body: offer
              ? `Quer continuar sua compra? ${offerText(offer, policy.timezone)}`
              : 'Continue de onde parou e confira os itens do seu carrinho. Se já comprou no caixa, marque a compra como concluída no app.',
            offer,
            cartKey: cart.cart_key,
          };
        }
      }
      if (!chosen && user.personalized_offers) {
        const frequent = await client.query<{ product_id: string }>(
          `select i.product_id from customer_purchase_items i
          join customer_purchases p on p.id=i.purchase_id where p.user_id=$1 and p.tenant_id=$2
          and p.purchased_at>$3::timestamptz-($4::int * interval '1 day')
          group by i.product_id having count(distinct p.id)>=$5`,
          [user.user_id, user.tenant_id, now, policy.purchaseWindowDays, policy.minimumPurchases],
        );
        const offers = await eligibleOffers(client, user.tenant_id, cart?.store_id ?? null, now);
        for (const offer of offers.filter((o) =>
          frequent.rows.some((p) => p.product_id === o.product_id),
        )) {
          const duplicate = (
            await client.query(
              'select id from customer_notifications where user_id=$1 and dedupe_key=$2',
              [user.user_id, `offer:${offer.id}`],
            )
          ).rows.length;
          if (duplicate) continue;
          chosen = {
            kind: 'offer',
            dedupe: `offer:${offer.id}`,
            title: 'Um produto que você compra está em oferta',
            body: offerText(offer, policy.timezone),
            offer,
            cartKey: null,
          };
          break;
        }
      }
      if (!chosen) continue;
      const result = await client.query<{ id: string }>(
        `insert into customer_notifications(tenant_id,user_id,kind,dedupe_key,title,body,offer_id,cart_key,created_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(user_id,dedupe_key) do nothing returning id`,
        [
          user.tenant_id,
          user.user_id,
          chosen.kind,
          chosen.dedupe,
          chosen.title,
          chosen.body,
          chosen.offer?.id ?? null,
          chosen.cartKey,
          now,
        ],
      );
      if (!result.rows[0]) continue;
      await client.query(
        `insert into push_deliveries(notification_id,device_id,next_attempt_at)
        select $1,d.id,$3 from push_devices d join sessions s on s.id=d.session_id
        where d.user_id=$2 and d.active and s.revoked_at is null and s.expires_at>$3`,
        [result.rows[0].id, user.user_id, now],
      );
    }
  });

  // Recupera leases após queda do processo. Entrega push é at-least-once em falhas de rede.
  await db.query(
    `update push_deliveries set status='pending',next_attempt_at=$1
    where status='sending' and claimed_at<$1::timestamptz-interval '5 minutes'`,
    [now],
  );
  for (let index = 0; index < 100; index++) {
    now = clock();
    if (!isNotificationHour(now, policy.timezone, policy.startHour, policy.endHour)) break;
    const claim = await db.query<{
      id: string;
      notification_id: string;
      device_id: string;
      attempts: number;
    }>(
      `update push_deliveries set status='sending',attempts=attempts+1,claimed_at=$1
      where id=(select id from push_deliveries where status='pending' and next_attempt_at<=$1
        order by next_attempt_at for update skip locked limit 1) returning id,notification_id,device_id,attempts`,
      [now],
    );
    const delivery = claim.rows[0];
    if (!delivery) break;
    const data = (
      await db.query(
        `select n.*,d.token,d.active,d.user_id as device_user,s.revoked_at,s.expires_at,u.disabled_at,u.role,t.status as tenant_status,t.is_demo,
      pref.cart_reminders,pref.personalized_offers,c.status as cart_status,c.cart_key as current_cart,c.last_activity_at,c.store_id
      from customer_notifications n join push_devices d on d.id=$2 join sessions s on s.id=d.session_id
      join users u on u.id=n.user_id join tenants t on t.id=n.tenant_id
      left join notification_preferences pref on pref.user_id=n.user_id left join customer_carts c on c.user_id=n.user_id
      where n.id=$1`,
        [delivery.notification_id, delivery.device_id],
      )
    ).rows[0];
    let invalid =
      !data ||
      !data.active ||
      data.device_user !== data.user_id ||
      data.revoked_at ||
      data.expires_at <= now ||
      data.disabled_at ||
      data.role !== 'customer' ||
      data.is_demo ||
      data.tenant_status === 'suspensa' ||
      (data.kind === 'cart' ? !data.cart_reminders : !data.personalized_offers) ||
      now.getTime() - new Date(data.created_at).getTime() > 24 * 3600000;
    if (data?.kind === 'cart')
      invalid ||=
        data.cart_status !== 'active' ||
        data.current_cart !== data.cart_key ||
        new Date(data.last_activity_at).getTime() <= now.getTime() - 24 * 3600000;
    let validOffer: Offer | undefined;
    if (!invalid && data.offer_id) {
      validOffer = (await eligibleOffers(db, data.tenant_id, data.store_id, now)).find(
        (o) => o.id === data.offer_id,
      );
      invalid ||= !validOffer;
    }
    if (invalid) {
      await db.query("update push_deliveries set status='cancelled' where id=$1", [delivery.id]);
      continue;
    }
    if (validOffer) {
      data.body =
        (data.kind === 'cart' ? 'Quer continuar sua compra? ' : '') +
        offerText(validOffer, policy.timezone);
      await db.query('update customer_notifications set body=$2 where id=$1', [data.id, data.body]);
    }
    if (
      data.kind === 'cart' &&
      new Date(data.last_activity_at).getTime() > now.getTime() - policy.cartReminderMinutes * 60000
    ) {
      await db.query(
        "update push_deliveries set status='pending',attempts=attempts-1,next_attempt_at=$2 where id=$1",
        [delivery.id, new Date(now.getTime() + 5 * 60000)],
      );
      continue;
    }
    try {
      now = clock();
      if (!isNotificationHour(now, policy.timezone, policy.startHour, policy.endHour)) {
        await db.query(
          "update push_deliveries set status='pending',attempts=attempts-1,next_attempt_at=$2 where id=$1",
          [delivery.id, new Date(now.getTime() + 60000)],
        );
        break;
      }
      if (validOffer?.ends_at && validOffer.ends_at <= now) {
        await db.query("update push_deliveries set status='cancelled' where id=$1", [delivery.id]);
        continue;
      }
      await db.query('update push_deliveries set sent_token=$2 where id=$1', [
        delivery.id,
        data.token,
      ]);
      const remaining = validOffer?.ends_at
        ? Math.floor((validOffer.ends_at.getTime() - now.getTime()) / 1000)
        : 3600;
      const ticket = await transport.send({
        to: data.token,
        title: data.title,
        body: data.body,
        channelId: 'shopping',
        sound: 'default',
        ttl: Math.max(1, Math.min(3600, remaining)),
        data: {
          notificationId: data.id,
          target: data.kind === 'cart' ? 'cart' : 'promotions',
          offerId: data.offer_id,
        },
      });
      if (ticket.status === 'error') {
        const code = ticket.details?.error ?? 'PushError';
        if (code === 'DeviceNotRegistered')
          await db.query('update push_devices set active=false where id=$1 and token=$2', [
            delivery.device_id,
            data.token,
          ]);
        const retry = code === 'MessageRateExceeded' && delivery.attempts < 5;
        await db.query(
          'update push_deliveries set status=$2,error_code=$3,next_attempt_at=$4 where id=$1',
          [
            delivery.id,
            retry ? 'pending' : 'failed',
            code,
            new Date(now.getTime() + 2 ** delivery.attempts * 60000),
          ],
        );
      } else
        await db.query(
          "update push_deliveries set status='ticket',ticket_id=$2,ticket_at=$3,next_attempt_at=$4 where id=$1",
          [delivery.id, ticket.id, now, new Date(now.getTime() + 15 * 60000)],
        );
    } catch {
      await db.query(
        'update push_deliveries set status=$2,error_code=$3,next_attempt_at=$4 where id=$1',
        [
          delivery.id,
          delivery.attempts < 5 ? 'pending' : 'failed',
          'TransportError',
          new Date(now.getTime() + 2 ** delivery.attempts * 60000),
        ],
      );
    }
  }
}

export function startEngagementWorker(db: Db, config: Config, onError: (error: unknown) => void) {
  let running = false;
  let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await runEngagement(db, config);
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 60000);
  timer.unref();
  void tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    while (running) await new Promise((resolve) => setTimeout(resolve, 50));
  };
}
