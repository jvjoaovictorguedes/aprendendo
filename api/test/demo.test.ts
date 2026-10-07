import assert from 'node:assert/strict';
import { after, before, it } from 'node:test';
import { startTestApi, PILOT, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers.js';
import {
  seedDemo,
  DEMO_TENANT,
  DEMO_CUSTOMER,
  DEMO_CPF,
  DEMO_CUSTOMER_PASSWORD,
  DEMO_PRODUCTS,
} from '../src/demo.js';
import { runEngagement } from '../src/engagement.js';

let api: Awaited<ReturnType<typeof startTestApi>>;
let customer: string, owner: string, realCustomer: string;
const ownerPassword = 'lojista-ficticio-2026';
const summary = {
  requestKey: 'demo-checkout-test-01',
  items: [{ barcode: DEMO_PRODUCTS[0].barcode, quantity: 1 }],
  originalTotal: 24.9,
  finalTotal: 22.41,
};
async function customerLogin() {
  const r = await api.request('POST', '/auth/customer/login', {
    tenant: DEMO_TENANT,
    body: { cpf: DEMO_CPF, password: DEMO_CUSTOMER_PASSWORD },
  });
  assert.equal(r.status, 200);
  return r.body.token as string;
}
before(async () => {
  api = await startTestApi();
  api.config.DEMO_ENABLED = true;
  api.config.DEMO_OWNER_PASSWORD = ownerPassword;
  await seedDemo(api.db, ownerPassword);
  owner = await api.login('demo@scanmercado.example', ownerPassword);
  customer = await customerLogin();
  realCustomer = (
    await api.request('POST', '/auth/customer/login', {
      tenant: PILOT,
      body: { cpf: '12345678900', password: '123456' },
    })
  ).body.token;
});
after(async () => api.stop());

it('seed separado é idempotente e não reverte ajustes do lojista a cada boot', async () => {
  await api.db.query('update products set price=25 where tenant_id=$1 and barcode=$2', [
    DEMO_TENANT,
    DEMO_PRODUCTS[0].barcode,
  ]);
  await seedDemo(api.db, ownerPassword);
  const rows = (
    await api.db.query('select price,barcode from products where tenant_id=$1 and active', [
      DEMO_TENANT,
    ])
  ).rows;
  assert.equal(rows.length, 10);
  assert.equal(Number(rows.find((r) => r.barcode === DEMO_PRODUCTS[0].barcode)!.price), 25);
  assert.equal(
    (
      await api.db.query('select count(*)::int as n from promotions where tenant_id=$1', [
        DEMO_TENANT,
      ])
    ).rows[0].n,
    4,
  );
});
it('marca apenas a loja fictícia e bloqueia cadastro de dados pessoais nela', async () => {
  const demo = await api.request('GET', '/public/demo', {
    tenant: DEMO_TENANT,
  });
  assert.equal(demo.body.enabled, true);
  assert.equal(demo.body.meatLabel, '2000100019603');
  assert.equal(demo.body.customerPassword, DEMO_CUSTOMER_PASSWORD);
  assert.deepEqual((await api.request('GET', '/public/demo', { tenant: PILOT })).body, {
    enabled: false,
    toolsEnabled: false,
  });
  const r = await api.request('POST', '/auth/customer/register', {
    tenant: DEMO_TENANT,
    body: { name: 'Pessoa real', cpf: '11144477735', password: 'senha-123456' },
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /conta fictícia/);
});
it('caixa simulado exige cliente da loja fictícia e valida catálogo', async () => {
  assert.equal((await api.request('POST', '/demo/checkout', { body: summary })).status, 401);
  assert.equal(
    (
      await api.request('POST', '/demo/checkout', {
        token: owner,
        body: summary,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api.request('POST', '/demo/checkout', {
        token: realCustomer,
        body: summary,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await api.request('POST', '/demo/checkout', {
        token: customer,
        body: { ...summary, items: [{ barcode: 'fora-da-loja', quantity: 1 }] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api.request('POST', '/demo/checkout', {
        token: customer,
        body: { ...summary, finalTotal: 100 },
      })
    ).status,
    400,
  );
});
it('caixa é idempotente e não cria compra ou pontos', async () => {
  const a = await api.request('POST', '/demo/checkout', {
    token: customer,
    body: summary,
  });
  const b = await api.request('POST', '/demo/checkout', {
    token: customer,
    body: { ...summary, finalTotal: 20 },
  });
  assert.equal(a.status, 201);
  assert.equal(a.body.id, b.body.id);
  assert.equal(b.body.summary.finalTotal, 22.41);
  assert.equal(a.body.paymentProcessed, false);
  assert.equal(a.body.pointsGranted, false);
  assert.equal(
    (await api.db.query('select points from users where id=$1', [DEMO_CUSTOMER])).rows[0].points,
    1250,
  );
  assert.equal(
    (
      await api.db.query('select count(*)::int as n from customer_purchases where tenant_id=$1', [
        DEMO_TENANT,
      ])
    ).rows[0].n,
    0,
  );
});
it('aviso aparece só na central e a rotina de retenção exclui a loja fictícia', async () => {
  const notification = { requestKey: 'demo-notification-test-01' };
  assert.equal(
    (
      await api.request('POST', '/demo/notification', {
        token: customer,
        body: notification,
      })
    ).body.pushSent,
    false,
  );
  await api.request('POST', '/demo/notification', {
    token: customer,
    body: notification,
  });
  await api.request('PUT', '/customer/preferences', {
    token: customer,
    body: { cartReminders: true, personalizedOffers: true },
  });
  await api.request('PUT', '/customer/devices', {
    token: customer,
    body: {
      installationId: 'demo-device-synthetic-01',
      token: 'ExpoPushToken[demoSyntheticTest01]',
      platform: 'android',
    },
  });
  await api.request('PUT', '/customer/cart', {
    token: customer,
    body: {
      cartKey: 'demo-cart-test-0001',
      revision: 1,
      storeId: null,
      items: [{ barcode: DEMO_PRODUCTS[0].barcode, quantity: 1 }],
    },
  });
  await api.db.query(
    "update customer_carts set last_activity_at=now()-interval '3 hours' where tenant_id=$1",
    [DEMO_TENANT],
  );
  api.config.PUSH_ENABLED = true;
  const now = new Date();
  now.setUTCHours(15, 0, 0, 0);
  await runEngagement(
    api.db,
    api.config,
    {
      async send() {
        throw new Error('Não deve enviar push da loja fictícia');
      },
      async receipts() {
        return {};
      },
    },
    now,
  );
  assert.equal(
    (
      await api.db.query(
        'select count(*)::int as n from customer_notifications where tenant_id=$1',
        [DEMO_TENANT],
      )
    ).rows[0].n,
    1,
  );
  assert.equal((await api.db.query('select count(*)::int as n from push_deliveries')).rows[0].n, 0);
});
it('restauração precisa de confirmação e não altera outra loja', async () => {
  const platform = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  await api.db.query("update products set plu='999' where tenant_id=$1 and plu='100'", [
    DEMO_TENANT,
  ]);
  await api.db.query(
    "insert into products(tenant_id,name,plu,price,unit,category) values($1,'Produto criado na apresentação','100',10,'kg','Açougue')",
    [DEMO_TENANT],
  );
  const before = (
    await api.db.query('select id,price,name from products where tenant_id=$1 order by id', [PILOT])
  ).rows;
  assert.equal(
    (
      await api.request('POST', `/admin/tenants/${PILOT}/demo/reset`, {
        token: owner,
        body: { confirmation: 'RESTAURAR DEMONSTRACAO' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api.request('POST', `/admin/tenants/${PILOT}/demo/reset`, {
        token: platform,
        body: { confirmation: 'RESTAURAR DEMONSTRACAO' },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await api.request('POST', `/admin/tenants/${DEMO_TENANT}/demo/reset`, {
        token: owner,
        body: {},
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api.request('POST', `/admin/tenants/${DEMO_TENANT}/demo/reset`, {
        token: owner,
        body: { confirmation: 'RESTAURAR DEMONSTRACAO' },
      })
    ).status,
    200,
  );
  assert.deepEqual(
    (
      await api.db.query('select id,price,name from products where tenant_id=$1 order by id', [
        PILOT,
      ])
    ).rows,
    before,
  );
  assert.equal(
    Number(
      (
        await api.db.query('select price from products where tenant_id=$1 and barcode=$2', [
          DEMO_TENANT,
          DEMO_PRODUCTS[0].barcode,
        ])
      ).rows[0].price,
    ),
    24.9,
  );
  assert.equal(
    (
      await api.db.query(
        'select count(*)::int as n from customer_notifications where tenant_id=$1',
        [DEMO_TENANT],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await api.db.query('select count(*)::int as n from demo_checkouts where tenant_id=$1', [
        DEMO_TENANT,
      ])
    ).rows[0].n,
    0,
  );
  assert.equal((await api.request('GET', '/auth/me', { token: customer })).status, 401);
  assert.equal((await api.request('GET', '/auth/me', { token: owner })).status, 200);
  customer = await customerLogin();
});
it('flag desliga ferramentas mesmo que a loja fictícia já exista', async () => {
  api.config.DEMO_ENABLED = false;
  assert.equal(
    (await api.request('GET', '/public/demo', { tenant: DEMO_TENANT })).body.toolsEnabled,
    false,
  );
  assert.equal(
    (
      await api.request('POST', '/demo/checkout', {
        token: customer,
        body: summary,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await api.request('POST', `/admin/tenants/${DEMO_TENANT}/demo/reset`, {
        token: owner,
        body: { confirmation: 'RESTAURAR DEMONSTRACAO' },
      })
    ).status,
    404,
  );
});
