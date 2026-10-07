import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, OTHER_TENANT, PILOT, startTestApi } from './helpers.js';
import {
  isNotificationHour,
  runEngagement,
  type PushMessage,
  type PushTransport,
} from '../src/engagement.js';

let api: Awaited<ReturnType<typeof startTestApi>>;
let customer: string,
  other: string,
  admin: string,
  userId: string,
  productId: string,
  productBarcode: string;
let sent: PushMessage[] = [];
const now = new Date();
now.setUTCHours(15, 0, 0, 0);
const transport: PushTransport = {
  async send(message) {
    sent.push(message);
    return { status: 'ok', id: `ticket-${sent.length}` };
  },
  async receipts(ids) {
    return Object.fromEntries(ids.map((id) => [id, { status: 'ok' }]));
  },
};
const cart = (overrides = {}) => ({
  cartKey: 'cart-test-000001',
  revision: 100,
  storeId: null,
  items: [{ barcode: productBarcode, quantity: 2 }],
  ...overrides,
});
const prefs = (overrides = {}) =>
  api.request('PUT', '/customer/preferences', {
    token: customer,
    body: { cartReminders: true, personalizedOffers: false, ...overrides },
  });
async function device(token = customer) {
  return api.request('PUT', '/customer/devices', {
    token,
    body: {
      installationId: 'device-test-000001',
      token: 'ExpoPushToken[testToken000001]',
      platform: 'android',
    },
  });
}
async function saveCart(overrides = {}) {
  return api.request('PUT', '/customer/cart', { token: customer, body: cart(overrides) });
}
async function ageCart(hours = 3) {
  await api.db.query('update customer_carts set last_activity_at=$1 where user_id=$2', [
    new Date(now.getTime() - hours * 3600000),
    userId,
  ]);
}
async function offer(
  overrides: { active?: boolean; startsAt?: Date; endsAt?: Date; storeId?: string | null } = {},
) {
  const result = await api.db.query(
    `insert into promotions(tenant_id,product_id,kind,label,percent,active,starts_at,ends_at,store_id)
    values($1,$2,'percent_off','Leite com 20% de desconto',20,$3,$4,$5,$6) returning id`,
    [
      PILOT,
      productId,
      overrides.active ?? true,
      overrides.startsAt ?? new Date(now.getTime() - 86400000),
      overrides.endsAt ?? new Date(now.getTime() + 86400000),
      overrides.storeId ?? null,
    ],
  );
  return result.rows[0].id as string;
}
async function purchase(index: number) {
  return api.request('POST', '/customer/purchases', {
    token: customer,
    body: {
      requestKey: `purchase-test-${index}`,
      cartKey: `cart-test-${String(index).padStart(6, '0')}`,
      storeId: null,
      items: cart().items,
    },
  });
}
async function run(time = now, t = transport) {
  await runEngagement(api.db, api.config, t, time);
}
async function inbox(token = customer) {
  return api.request('GET', '/customer/notifications', { token });
}

before(async () => {
  api = await startTestApi();
  admin = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const login = await api.request('POST', '/auth/customer/login', {
    tenant: PILOT,
    body: { cpf: '12345678900', password: '123456' },
  });
  customer = login.body.token;
  userId = login.body.user.id;
  const registration = await api.request('POST', '/auth/customer/register', {
    tenant: OTHER_TENANT,
    body: { name: 'Outro cliente', cpf: '52998224725', password: 'senha-cliente-123' },
  });
  other = registration.body.token;
  const product = await api.db.query(
    'select id,barcode from products where tenant_id=$1 and name=$2',
    [PILOT, 'Leite Integral 1L'],
  );
  productId = product.rows[0].id;
  productBarcode = product.rows[0].barcode;
});
after(async () => api.stop());
beforeEach(async () => {
  sent = [];
  await api.db.query('delete from customer_notifications');
  await api.db.query('delete from customer_purchases');
  await api.db.query('delete from customer_carts');
  await api.db.query('delete from push_devices');
  await api.db.query('delete from notification_preferences');
  await api.db.query('update promotions set active=false');
});

describe('consentimento, dados e isolamento', () => {
  it('preferências começam desligadas e exigem cliente autenticado', async () => {
    assert.deepEqual(
      (await api.request('GET', '/customer/preferences', { token: customer })).body,
      { cartReminders: false, personalizedOffers: false },
    );
    assert.equal((await api.request('GET', '/customer/preferences')).status, 401);
    assert.equal((await api.request('GET', '/customer/preferences', { token: admin })).status, 403);
    await device();
    await saveCart();
    await ageCart();
    await run();
    assert.equal(sent.length, 0);
  });
  it('recusa tokens inválidos e produtos/lojas de outra franquia', async () => {
    assert.equal(
      (
        await api.request('PUT', '/customer/devices', {
          token: customer,
          body: {
            installationId: 'device-test-000001',
            token: 'http://example.com',
            platform: 'android',
          },
        })
      ).status,
      400,
    );
    await api.db.query(
      `insert into products(tenant_id,barcode,name,price,unit,category) values($1,'9998887776661','Só outra loja',1,'un','Teste')`,
      [OTHER_TENANT],
    );
    assert.equal(
      (await saveCart({ items: [{ barcode: '9998887776661', quantity: 1 }] })).status,
      400,
    );
    const store = await api.db.query(
      "insert into stores(tenant_id,name,address,hours) values($1,'Outra loja','Outra rua','8h às 18h') returning id",
      [OTHER_TENANT],
    );
    assert.equal((await saveCart({ storeId: store.rows[0].id })).status, 400);
  });
  it('revisões antigas não substituem o carrinho mais recente', async () => {
    await saveCart({ revision: 200 });
    await saveCart({ revision: 100, items: [] });
    const current = (await api.db.query('select * from customer_carts where user_id=$1', [userId]))
      .rows[0];
    assert.equal(Number(current.revision), 200);
    assert.equal(current.status, 'active');
    assert.equal(current.items[0].quantity, 2);
  });
  it('compras são declaradas, idempotentes e sem crédito automático de pontos', async () => {
    await saveCart();
    const previous = (await api.db.query('select points from users where id=$1', [userId])).rows[0]
      .points;
    const [a, b] = await Promise.all([purchase(1), purchase(1)]);
    assert.equal(a.body.id, b.body.id);
    assert.equal(a.body.source, 'self_reported');
    assert.equal(
      (await api.db.query('select count(*)::int as count from customer_purchases')).rows[0].count,
      1,
    );
    assert.equal(
      (await api.db.query('select points from users where id=$1', [userId])).rows[0].points,
      previous,
    );
    assert.equal(
      (await api.db.query('select status from customer_carts where user_id=$1', [userId])).rows[0]
        .status,
      'closed',
    );
  });
  it('sincronização atrasada não reabre carrinho confirmado', async () => {
    await saveCart();
    await purchase(1);
    await saveCart({ revision: 999 });
    assert.equal(
      (await api.db.query('select status from customer_carts where user_id=$1', [userId])).rows[0]
        .status,
      'closed',
    );
    await saveCart({ revision: 1000, cartKey: 'cart-test-000002' });
    assert.equal(
      (await api.db.query('select status from customer_carts where user_id=$1', [userId])).rows[0]
        .status,
      'active',
    );
  });
  it('registro repetido preserva dispositivo; troca de conta tira o dono anterior', async () => {
    await device();
    const previous = (await api.db.query('select id from push_devices')).rows[0].id;
    await device();
    assert.equal((await api.db.query('select id from push_devices')).rows[0].id, previous);
    await device(other);
    assert.equal(
      (
        await api.db.query('select count(*)::int as count from push_devices where user_id=$1', [
          userId,
        ])
      ).rows[0].count,
      0,
    );
  });
});

describe('regras de retenção', () => {
  it('duas rotinas concorrentes geram e enviam um único aviso', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    await Promise.all([run(), run()]);
    assert.equal(sent.length, 1);
    assert.equal((await inbox()).body.length, 1);
  });
  it('a mesma compra não conta duas vezes com uma nova chave de requisição', async () => {
    const first = await purchase(1);
    const repeated = await api.request('POST', '/customer/purchases', {
      token: customer,
      body: {
        requestKey: 'different-request-0001',
        cartKey: 'cart-test-000001',
        storeId: null,
        items: cart().items,
      },
    });
    assert.equal(first.body.id, repeated.body.id);
    assert.equal(
      (await api.db.query('select count(*)::int as count from customer_purchases')).rows[0].count,
      1,
    );
  });
  it('lembra depois de duas horas, inclui oferta e não repete o carrinho', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    const id = await offer();
    await run();
    assert.equal(sent.length, 1);
    assert.match(sent[0].body, /Leite/);
    assert.equal(sent[0].data.offerId, id);
    assert.equal(sent[0].data.target, 'cart');
    await run();
    await run(new Date(now.getTime() + 86400000));
    assert.equal(sent.length, 1);
  });
  it('não lembra carrinho recente, vazio, confirmado ou com mais de um dia', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart(1);
    await run();
    assert.equal(sent.length, 0);
    await ageCart(25);
    await run();
    assert.equal(sent.length, 0);
    await saveCart({ revision: 101, items: [] });
    await ageCart();
    await run();
    assert.equal(sent.length, 0);
    await saveCart({ revision: 102, cartKey: 'cart-test-000002' });
    await api.db.query("update customer_carts set status='closed'");
    await ageCart();
    await run();
    assert.equal(sent.length, 0);
  });
  it('só recomenda após três compras declaradas daquele produto em 90 dias', async () => {
    await prefs({ cartReminders: false, personalizedOffers: true });
    await device();
    await offer();
    await saveCart();
    await ageCart();
    await run();
    assert.equal(sent.length, 0);
    await purchase(1);
    await purchase(2);
    await run();
    assert.equal(sent.length, 0);
    await purchase(3);
    await run();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].data.target, 'promotions');
    await run(new Date(now.getTime() + 86400000));
    assert.equal(sent.length, 1);
  });
  it('não usa compras antigas', async () => {
    await prefs({ cartReminders: false, personalizedOffers: true });
    await device();
    await offer();
    await purchase(1);
    await purchase(2);
    await purchase(3);
    await api.db.query('update customer_purchases set purchased_at=$1', [
      new Date(now.getTime() - 91 * 86400000),
    ]);
    await run();
    assert.equal(sent.length, 0);
  });
  it('respeita horário silencioso e limita a um aviso por 24 horas', async () => {
    assert.equal(isNotificationHour(new Date('2026-10-07T10:59:00Z'), 'America/Sao_Paulo'), false);
    assert.equal(isNotificationHour(new Date('2026-10-07T11:00:00Z'), 'America/Sao_Paulo'), true);
    assert.equal(isNotificationHour(new Date('2026-10-08T01:00:00Z'), 'America/Sao_Paulo'), false);
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    const quiet = new Date(now);
    quiet.setUTCHours(10);
    await run(quiet);
    assert.equal(sent.length, 0);
    await run();
    assert.equal(sent.length, 1);
    await saveCart({ cartKey: 'cart-test-000002', revision: 102 });
    await ageCart();
    await run();
    assert.equal(sent.length, 1);
  });
  it('não anuncia ofertas vencidas, futuras, pausadas ou de loja diferente', async () => {
    await prefs({ cartReminders: false, personalizedOffers: true });
    await device();
    await purchase(1);
    await purchase(2);
    await purchase(3);
    await offer({ endsAt: new Date(now.getTime() - 1000) });
    await offer({ startsAt: new Date(now.getTime() + 1000) });
    await offer({ active: false });
    const store = (await api.db.query('select id from stores where tenant_id=$1 limit 1', [PILOT]))
      .rows[0].id;
    await offer({ storeId: store });
    await run();
    assert.equal(sent.length, 0);
    await saveCart({ storeId: store });
    await run();
    assert.equal(sent.length, 1);
  });
});

describe('fila push, revogação e recibos', () => {
  it('TTL não ultrapassa o fim da promoção', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    await offer({ endsAt: new Date(now.getTime() + 10 * 60000) });
    await run();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].ttl, 600);
  });
  it('limpar o carrinho cancela o lembrete que aguardava retry', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    await run(now, {
      ...transport,
      async send() {
        throw new Error('offline');
      },
    });
    await saveCart({ revision: 101, items: [] });
    await run(new Date(now.getTime() + 3 * 60000));
    assert.equal(sent.length, 0);
    assert.equal(
      (await api.db.query('select status from push_deliveries')).rows[0].status,
      'cancelled',
    );
  });
  it('um recibo de token antigo não desativa o token atualizado do celular', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    await run();
    await api.request('PUT', '/customer/devices', {
      token: customer,
      body: {
        installationId: 'device-test-000001',
        token: 'ExpoPushToken[newToken000001]',
        platform: 'android',
      },
    });
    await run(new Date(now.getTime() + 16 * 60000), {
      ...transport,
      async receipts(ids) {
        return { [ids[0]]: { status: 'error', details: { error: 'DeviceNotRegistered' } } };
      },
    });
    const current = (await api.db.query('select active,token from push_devices')).rows[0];
    assert.equal(current.active, true);
    assert.equal(current.token, 'ExpoPushToken[newToken000001]');
  });
  it('falha de transporte tem retry com backoff sem criar outro aviso', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    await run(now, {
      ...transport,
      async send() {
        throw new Error('offline');
      },
    });
    assert.equal((await inbox()).body.length, 1);
    assert.equal(
      (await api.db.query('select status from push_deliveries')).rows[0].status,
      'pending',
    );
    await run(new Date(now.getTime() + 3 * 60000));
    assert.equal(sent.length, 1);
    await run(new Date(now.getTime() + 20 * 60000));
    assert.equal(
      (await api.db.query('select status from push_deliveries')).rows[0].status,
      'delivered',
    );
  });
  it('desativar preferência cancela um aviso que aguardava retry', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    await run(now, {
      ...transport,
      async send() {
        throw new Error('offline');
      },
    });
    await prefs({ cartReminders: false });
    await run(new Date(now.getTime() + 3 * 60000));
    assert.equal(sent.length, 0);
    assert.equal(
      (await api.db.query('select status from push_deliveries')).rows[0].status,
      'cancelled',
    );
  });
  it('revalida a oferta antes do retry', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    const id = await offer({ endsAt: new Date(now.getTime() + 10 * 60000) });
    await run(now, {
      ...transport,
      async send() {
        throw new Error('offline');
      },
    });
    await api.db.query('update promotions set active=false where id=$1', [id]);
    await run(new Date(now.getTime() + 3 * 60000));
    assert.equal(sent.length, 0);
    assert.equal(
      (await api.db.query('select status from push_deliveries')).rows[0].status,
      'cancelled',
    );
  });
  it('DeviceNotRegistered no recibo desativa o dispositivo', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    await run();
    await run(new Date(now.getTime() + 16 * 60000), {
      ...transport,
      async receipts(ids) {
        return { [ids[0]]: { status: 'error', details: { error: 'DeviceNotRegistered' } } };
      },
    });
    assert.equal((await api.db.query('select active from push_devices')).rows[0].active, false);
    assert.equal(
      (await api.db.query('select status from push_deliveries')).rows[0].status,
      'failed',
    );
  });
  it('leitura e abertura de aviso pertencem apenas ao próprio cliente', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    await run();
    const id = (await inbox()).body[0].id;
    assert.equal((await inbox(other)).body.length, 0);
    assert.equal(
      (
        await api.request('POST', `/customer/notifications/${id}/read`, {
          token: other,
          body: { opened: true },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await api.request('POST', `/customer/notifications/${id}/read`, {
          token: customer,
          body: { opened: true },
        })
      ).status,
      200,
    );
    const n = (
      await api.db.query('select read_at,opened_at from customer_notifications where id=$1', [id])
    ).rows[0];
    assert.ok(n.read_at);
    assert.ok(n.opened_at);
  });
  it('logout impede envio para a sessão revogada', async () => {
    await prefs();
    await device();
    await saveCart();
    await ageCart();
    await api.request('POST', '/auth/logout', { token: customer });
    await run();
    assert.equal(sent.length, 0);
  });
});
