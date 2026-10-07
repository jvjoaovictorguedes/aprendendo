import assert from 'node:assert/strict';
import { after, before, it } from 'node:test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, PILOT, startTestApi } from './helpers.js';
import { runEngagement, isNotificationHour } from '../src/engagement.js';
let api: Awaited<ReturnType<typeof startTestApi>>;
let admin: string, owner: string, customer: string;
let defaults: Record<string, unknown>;
before(async () => {
  api = await startTestApi();
  admin = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const created = await api.request('POST', '/admin/users', {
    token: admin,
    body: {
      name: 'Dono teste',
      email: 'owner-notify@test.example',
      password: 'senha-123456',
      role: 'tenant_admin',
      tenantId: PILOT,
      mustChangePassword: false,
    },
  });
  owner = await api.login('owner-notify@test.example', created.body.temporaryPassword);
  customer = (
    await api.request('POST', '/auth/customer/login', {
      tenant: PILOT,
      body: { cpf: '12345678900', password: '123456' },
    })
  ).body.token;
  defaults = (await api.request('GET', '/admin/notification-settings', { token: admin })).body
    .settings;
});
after(async () => api.stop());
it('somente platform_admin consulta e altera políticas', async () => {
  for (const token of [owner, customer])
    for (const method of ['GET', 'PUT'])
      assert.equal(
        (
          await api.request(method, '/admin/notification-settings', {
            token,
            ...(method === 'PUT' ? { body: defaults } : {}),
          })
        ).status,
        403,
      );
  assert.equal((await api.request('GET', '/admin/notification-settings')).status, 401);
});
it('preserva padrões existentes e expõe status do servidor sem segredos', async () => {
  assert.deepEqual(defaults, {
    enabled: true,
    timezone: 'America/Sao_Paulo',
    startHour: 8,
    endHour: 22,
    cartReminderMinutes: 120,
    minimumIntervalMinutes: 1440,
    minimumPurchases: 3,
    purchaseWindowDays: 90,
  });
  const r = await api.request('GET', '/admin/notification-settings', { token: admin });
  assert.equal(r.body.serverPushEnabled, false);
  assert.equal(r.body.EXPO_ACCESS_TOKEN, undefined);
});
it('valida intervalos, fuso e janelas e rejeita campos extras', async () => {
  for (const extra of [
    { cartReminderMinutes: 0 },
    { minimumIntervalMinutes: 0 },
    { minimumPurchases: 0 },
    { purchaseWindowDays: 366 },
    { timezone: 'Invalid/Zone' },
    { startHour: 22, endHour: 22 },
    { enabled: 'true' },
    { secret: 'não permitido' },
  ])
    assert.equal(
      (
        await api.request('PUT', '/admin/notification-settings', {
          token: admin,
          body: { ...defaults, ...extra },
        })
      ).status,
      400,
    );
});
it('persiste parâmetros e registra quem alterou', async () => {
  const v = {
    ...defaults,
    cartReminderMinutes: 1,
    minimumIntervalMinutes: 1,
    minimumPurchases: 1,
    startHour: 0,
    endHour: 24,
  };
  assert.equal(
    (await api.request('PUT', '/admin/notification-settings', { token: admin, body: v })).status,
    200,
  );
  assert.deepEqual(
    (await api.request('GET', '/admin/notification-settings', { token: admin })).body.settings,
    v,
  );
  assert.ok(
    (await api.db.query('select updated_by,updated_at from platform_notification_settings')).rows[0]
      .updated_by,
  );
});
it('permite dia inteiro e janela noturna no fuso configurado', () => {
  assert.equal(
    isNotificationHour(new Date('2026-10-07T03:30:00Z'), 'America/Sao_Paulo', 0, 24),
    true,
  );
  assert.equal(
    isNotificationHour(new Date('2026-10-07T03:30:00Z'), 'America/Sao_Paulo', 22, 6),
    true,
  );
  assert.equal(
    isNotificationHour(new Date('2026-10-07T15:00:00Z'), 'America/Sao_Paulo', 22, 6),
    false,
  );
});
it('rotina aplica pausa e lembrete de um minuto sem envio externo', async () => {
  const barcode = (
    await api.db.query(
      'select barcode from products where tenant_id=$1 and active and barcode is not null limit 1',
      [PILOT],
    )
  ).rows[0].barcode;
  await api.request('PUT', '/customer/preferences', {
    token: customer,
    body: { cartReminders: true, personalizedOffers: false },
  });
  await api.request('PUT', '/customer/devices', {
    token: customer,
    body: {
      installationId: 'platform-test-device01',
      token: 'ExpoPushToken[platformTest01]',
      platform: 'android',
    },
  });
  assert.equal(
    (
      await api.request('PUT', '/customer/cart', {
        token: customer,
        body: {
          cartKey: 'platform-cart-test01',
          revision: 1,
          storeId: null,
          items: [{ barcode, quantity: 1 }],
        },
      })
    ).status,
    200,
  );
  const now = new Date();
  await api.db.query('update customer_carts set last_activity_at=$1', [
    new Date(now.getTime() - 120000),
  ]);
  let sends = 0;
  const transport = {
    async send() {
      sends++;
      return { status: 'ok' as const, id: 'platform-ticket-test01' };
    },
    async receipts() {
      return {};
    },
  };
  const settings = {
    ...defaults,
    startHour: 0,
    endHour: 24,
    cartReminderMinutes: 1,
    minimumIntervalMinutes: 1,
  };
  await api.request('PUT', '/admin/notification-settings', {
    token: admin,
    body: { ...settings, enabled: false },
  });
  await runEngagement(api.db, api.config, transport, now);
  assert.equal(sends, 0);
  await api.request('PUT', '/admin/notification-settings', {
    token: admin,
    body: { ...settings, enabled: true },
  });
  await runEngagement(api.db, api.config, transport, now);
  assert.equal(sends, 1);
  await runEngagement(api.db, api.config, transport, new Date(now.getTime() + 120000));
  assert.equal(sends, 1, 'não repete o mesmo carrinho');
});

it('quantidade de compras e janela de histórico alteram a seleção de ofertas', async () => {
  await api.db.query('delete from customer_notifications');
  await api.db.query('delete from customer_purchases');
  await api.db.query('update promotions set active=false where tenant_id=$1', [PILOT]);
  const product = (
    await api.db.query(
      'select id,barcode from products where tenant_id=$1 and active and barcode is not null limit 1',
      [PILOT],
    )
  ).rows[0];
  await api.db.query(
    "insert into promotions(tenant_id,product_id,kind,label,percent) values($1,$2,'percent_off','Oferta teste',10)",
    [PILOT, product.id],
  );
  await api.request('PUT', '/customer/preferences', {
    token: customer,
    body: { cartReminders: false, personalizedOffers: true },
  });
  assert.equal(
    (
      await api.request('POST', '/customer/purchases', {
        token: customer,
        body: {
          requestKey: 'platform-purchase01',
          cartKey: 'platform-purchased-cart01',
          storeId: null,
          items: [{ barcode: product.barcode, quantity: 1 }],
        },
      })
    ).status,
    201,
  );
  const now = new Date();
  await api.db.query('update customer_purchases set purchased_at=$1', [
    new Date(now.getTime() - 2 * 86400000),
  ]);
  const settings = {
    ...defaults,
    startHour: 0,
    endHour: 24,
    minimumIntervalMinutes: 1,
    purchaseWindowDays: 90,
    minimumPurchases: 2,
  };
  let sends = 0;
  const transport = {
    async send() {
      sends++;
      return { status: 'ok' as const, id: 'platform-frequency01' };
    },
    async receipts() {
      return {};
    },
  };
  await api.request('PUT', '/admin/notification-settings', { token: admin, body: settings });
  await runEngagement(api.db, api.config, transport, now);
  assert.equal(sends, 0);
  await api.request('PUT', '/admin/notification-settings', {
    token: admin,
    body: { ...settings, minimumPurchases: 1, purchaseWindowDays: 1 },
  });
  await runEngagement(api.db, api.config, transport, now);
  assert.equal(sends, 0);
  await api.request('PUT', '/admin/notification-settings', {
    token: admin,
    body: { ...settings, minimumPurchases: 1, purchaseWindowDays: 90 },
  });
  await runEngagement(api.db, api.config, transport, now);
  assert.equal(sends, 1);
});
