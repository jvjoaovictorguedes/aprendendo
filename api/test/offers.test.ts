import assert from 'node:assert/strict';
import { before, after, describe, it } from 'node:test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, PILOT, OTHER_TENANT, startTestApi } from './helpers.js';

let api: Awaited<ReturnType<typeof startTestApi>>;
let admin: string,
  owner: string,
  customer: string,
  productId: string,
  storeId: string,
  clubId: string;
before(async () => {
  api = await startTestApi();
  admin = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const created = await api.request('POST', '/admin/users', {
    token: admin,
    body: {
      name: 'Dono',
      email: 'owner@test.com',
      role: 'tenant_admin',
      tenantId: PILOT,
      password: 'owner-password',
      mustChangePassword: false,
    },
  });
  assert.equal(created.status, 201);
  owner = await api.login('owner@test.com', created.body.temporaryPassword);
  // O painel só libera as rotas depois de trocar a senha temporária.
  const changed = await api.request('POST', '/auth/change-password', {
    token: owner,
    body: { currentPassword: created.body.temporaryPassword, newPassword: 'owner-password' },
  });
  assert.equal(changed.status, 200);
  customer = (
    await api.request('POST', '/auth/customer/login', {
      tenant: PILOT,
      body: { cpf: '12345678900', password: '123456' },
    })
  ).body.token;
  productId = (
    await api.request('GET', `/admin/tenants/${PILOT}/products?search=Leite`, {
      token: owner,
    })
  ).body[0].id;
  storeId = (
    await api.request('POST', `/admin/tenants/${PILOT}/stores`, {
      token: owner,
      body: {
        name: 'Loja teste',
        address: 'Rua 1',
        hours: '8h–20h',
        active: true,
      },
    })
  ).body.id;
});
after(async () => api.stop());
const draft = (extra: Record<string, unknown> = {}) => ({
  productId,
  label: 'Oferta teste',
  audience: 'all',
  kind: 'percent_off',
  percent: 20,
  storeId: null,
  startsAt: '2020-01-01T00:00:00Z',
  endsAt: '2099-01-01T00:00:00Z',
  maxQuantity: 2,
  conditions: 'Até 2 unidades por compra.',
  active: true,
  ...extra,
});
const create = (body: unknown) =>
  api.request('POST', `/admin/tenants/${PILOT}/offers`, { token: owner, body });
const feed = (query = '') => api.request('GET', '/public/offers' + query, { tenant: PILOT });

describe('ofertas, lojas e isolamento', () => {
  it('lojista cria, edita e pausa oferta própria', async () => {
    const r = await create(draft());
    assert.equal(r.status, 201);
    assert.equal(r.body.product.name, 'Leite Integral 1L');
    assert.equal(r.body.maxQuantity, 2);
    const edit = await api.request('PUT', `/admin/tenants/${PILOT}/offers/${r.body.id}`, {
      token: owner,
      body: draft({ label: 'Editada', percent: 30 }),
    });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.percent, 30);
    assert.equal(
      (await api.request('DELETE', `/admin/tenants/${PILOT}/offers/${r.body.id}`, { token: owner }))
        .status,
      200,
    );
    assert.ok(!(await feed()).body.some((o: { id: string }) => o.id === r.body.id));
  });
  it('clientes não administram e lojista não acessa outra franquia', async () => {
    assert.equal(
      (
        await api.request('GET', `/admin/tenants/${OTHER_TENANT}/offers`, {
          token: owner,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api.request('POST', `/admin/tenants/${OTHER_TENANT}/offers`, {
          token: owner,
          body: draft(),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api.request('POST', `/admin/tenants/${PILOT}/offers`, {
          token: customer,
          body: draft(),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api.request('POST', `/admin/tenants/${OTHER_TENANT}/offers`, {
          token: admin,
          body: draft(),
        })
      ).status,
      400,
    );
    const otherStore = (
      await api.request('POST', `/admin/tenants/${OTHER_TENANT}/stores`, {
        token: admin,
        body: { name: 'Outra', active: true },
      })
    ).body.id;
    assert.equal((await create(draft({ storeId: otherStore }))).status, 400);
    assert.equal(
      (await api.request('GET', '/public/offers', { tenant: OTHER_TENANT })).body.length,
      0,
    );
  });
  it('recusa percentual, datas, preço, grupos e limites inválidos', async () => {
    for (const patch of [
      { percent: 101 },
      { endsAt: '2019-01-01T00:00:00Z' },
      { kind: 'fixed_price', price: 999 },
      { kind: 'buy_x_pay_y', buy: 3, pay: 3 },
      { kind: 'buy_x_pay_y', buy: 3, pay: 2, maxQuantity: 4 },
      { maxQuantity: 1.5 },
      { audience: 'club', kind: 'fixed_price', price: 1 },
    ])
      assert.equal((await create(draft(patch))).status, 400, JSON.stringify(patch));
    const kg = (
      await api.request('GET', `/admin/tenants/${PILOT}/products?search=Maçã`, {
        token: owner,
      })
    ).body[0];
    assert.equal(
      (
        await create(
          draft({
            productId: kg.id,
            kind: 'buy_x_pay_y',
            buy: 3,
            pay: 2,
            maxQuantity: 3,
          }),
        )
      ).status,
      400,
    );
  });
  it('exclui ofertas futuras, vencidas e pausadas', async () => {
    for (const patch of [
      { startsAt: '2098-01-01T00:00:00Z' },
      { endsAt: '2021-01-01T00:00:00Z' },
      { active: false },
    ]) {
      const r = await create(draft(patch));
      assert.equal(r.status, 201);
      assert.ok(!(await feed()).body.some((o: { id: string }) => o.id === r.body.id));
    }
  });
  it('filtra por loja e entrega a mesma promoção ao scanner; loja inativa perde oferta', async () => {
    const r = await create(draft({ storeId, startsAt: new Date(Date.now() - 500).toISOString() }));
    assert.equal(r.status, 201);
    const id = r.body.id;
    assert.ok(!(await feed()).body.some((o: { id: string }) => o.id === id));
    assert.ok((await feed(`?storeId=${storeId}`)).body.some((o: { id: string }) => o.id === id));
    const scanned = await api.request(
      'GET',
      `/public/products/barcode/7891000200104?storeId=${storeId}`,
      { tenant: PILOT },
    );
    assert.equal(scanned.body.promotion.id, id);
    assert.equal(scanned.body.promotion.maxQuantity, 2);
    await api.request('PUT', `/admin/tenants/${PILOT}/stores/${storeId}`, {
      token: owner,
      body: { name: 'Loja teste', active: false },
    });
    assert.ok(!(await feed(`?storeId=${storeId}`)).body.some((o: { id: string }) => o.id === id));
    assert.notEqual(
      (
        await api.request('GET', `/public/products/barcode/7891000200104?storeId=${storeId}`, {
          tenant: PILOT,
        })
      ).body.promotion?.id,
      id,
    );
  });
  it('ativação é persistida e idempotente, sem aplicar cupom na oferta geral anônima', async () => {
    const r = await create(
      draft({
        audience: 'club',
        startsAt: new Date(Date.now() - 100).toISOString(),
      }),
    );
    assert.equal(r.status, 201);
    clubId = r.body.id;
    assert.equal((await api.request('PUT', `/customer/activations/${clubId}`)).status, 401);
    assert.equal(
      (
        await api.request('PUT', `/customer/activations/${clubId}`, {
          token: owner,
        })
      ).status,
      403,
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await api.request('PUT', `/customer/activations/${clubId}`, {
            token: customer,
          })
        ).status,
        200,
      );
    assert.ok(
      (await api.request('GET', '/customer/activations', { token: customer })).body.includes(
        clubId,
      ),
    );
    assert.notEqual(
      (
        await api.request('GET', '/public/products/barcode/7891000200104', {
          tenant: PILOT,
        })
      ).body.promotion.id,
      clubId,
    );
    await api.request('DELETE', `/customer/activations/${clubId}`, {
      token: customer,
    });
    assert.ok(
      !(await api.request('GET', '/customer/activations', { token: customer })).body.includes(
        clubId,
      ),
    );
    const general = (await feed()).body.find((o: { audience: string }) => o.audience === 'all');
    assert.equal(
      (
        await api.request('PUT', `/customer/activations/${general.id}`, {
          token: customer,
        })
      ).status,
      404,
    );
  });
  it('outro cliente não ativa cupom desta franquia e pausa impede ativação', async () => {
    const { hashPassword } = await import('../src/auth/password.js');
    await api.db.query(
      "insert into users (name,role,tenant_id,cpf,password_hash) values ('Outro','customer',$1,'11122233344',$2)",
      [OTHER_TENANT, await hashPassword('customer-password')],
    );
    const other = (
      await api.request('POST', '/auth/customer/login', {
        tenant: OTHER_TENANT,
        body: { cpf: '11122233344', password: 'customer-password' },
      })
    ).body.token;
    assert.equal(
      (
        await api.request('PUT', `/customer/activations/${clubId}`, {
          token: other,
        })
      ).status,
      404,
    );
    await api.request('DELETE', `/admin/tenants/${PILOT}/offers/${clubId}`, {
      token: owner,
    });
    assert.equal(
      (
        await api.request('PUT', `/customer/activations/${clubId}`, {
          token: customer,
        })
      ).status,
      404,
    );
  });
});
describe('fidelidade', () => {
  const rule = {
    enabled: true,
    rewardName: 'Café no balcão',
    pointsRequired: 1000,
    pointsPerReal: 2,
    conditions: 'Retirar na loja participante.',
  };
  it('lojista configura benefício concreto', async () => {
    assert.equal(
      (
        await api.request('PUT', `/admin/tenants/${PILOT}/loyalty`, {
          token: owner,
          body: rule,
        })
      ).status,
      200,
    );
    assert.deepEqual((await api.request('GET', '/public/loyalty', { tenant: PILOT })).body, rule);
    assert.equal(
      (
        await api.request('PUT', `/admin/tenants/${OTHER_TENANT}/loyalty`, {
          token: owner,
          body: rule,
        })
      ).status,
      403,
    );
  });
  it('troca debita uma vez, recusa pontos insuficientes e entrega é única', async () => {
    const before = (await api.request('GET', '/auth/me', { token: customer })).body.points;
    const body = { requestKey: 'test-reward-request-001' };
    const r = await api.request('POST', '/customer/rewards', {
      token: customer,
      body,
    });
    assert.equal(r.status, 201);
    assert.equal(
      (
        await api.request('POST', '/customer/rewards', {
          token: customer,
          body,
        })
      ).body.id,
      r.body.id,
    );
    assert.equal(
      (await api.request('GET', '/auth/me', { token: customer })).body.points,
      before - 1000,
    );
    assert.equal(
      (
        await api.request('POST', '/customer/rewards', {
          token: customer,
          body: { requestKey: 'test-reward-request-002' },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api.request('POST', `/admin/tenants/${OTHER_TENANT}/rewards/${r.body.id}/redeem`, {
          token: owner,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api.request('POST', `/admin/tenants/${PILOT}/rewards/${r.body.id}/redeem`, {
          token: owner,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request('POST', `/admin/tenants/${PILOT}/rewards/${r.body.id}/redeem`, {
          token: owner,
        })
      ).status,
      400,
    );
    assert.ok(
      (await api.request('GET', '/customer/rewards', { token: customer })).body[0].redeemedAt,
    );
  });
  it('crédito exige admin e comprovante único, isolado da outra franquia', async () => {
    const body = {
      cpf: '12345678900',
      receipt: 'loja1-2026-0001',
      total: 50.5,
    };
    assert.equal(
      (
        await api.request('POST', `/admin/tenants/${PILOT}/loyalty/credits`, {
          token: customer,
          body,
        })
      ).status,
      403,
    );
    const before = (await api.request('GET', '/auth/me', { token: customer })).body.points;
    const r = await api.request('POST', `/admin/tenants/${PILOT}/loyalty/credits`, {
      token: owner,
      body,
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.points, 101);
    assert.equal(
      (
        await api.request('POST', `/admin/tenants/${PILOT}/loyalty/credits`, {
          token: owner,
          body,
        })
      ).status,
      409,
    );
    assert.equal(
      (await api.request('GET', '/auth/me', { token: customer })).body.points,
      before + 101,
    );
    assert.equal(
      (
        await api.request('POST', `/admin/tenants/${OTHER_TENANT}/loyalty/credits`, {
          token: admin,
          body: { ...body, receipt: 'new' },
        })
      ).status,
      400,
    );
  });
});

describe('cadastro do clube', () => {
  it('valida CPF e cria cliente sem privilégios administrativos', async () => {
    assert.equal(
      (
        await api.request('POST', '/auth/customer/register', {
          tenant: PILOT,
          body: { name: 'Cliente', cpf: '11111111111', password: 'senha-segura' },
        })
      ).status,
      400,
    );
    const body = {
      name: 'Cliente do Clube',
      cpf: '52998224725',
      password: 'senha-segura',
      role: 'platform_admin',
    };
    const result = await api.request('POST', '/auth/customer/register', { tenant: PILOT, body });
    assert.equal(result.status, 201);
    assert.equal(result.body.user.role, 'customer');
    assert.equal(result.body.user.tenantId, PILOT);
    assert.equal(result.body.user.points, 0);
    assert.equal(
      (await api.request('GET', `/admin/tenants/${PILOT}/offers`, { token: result.body.token }))
        .status,
      403,
    );
    assert.equal(
      (await api.request('POST', '/auth/customer/register', { tenant: PILOT, body })).status,
      409,
    );
    assert.equal(
      (
        await api.request('POST', '/auth/customer/login', {
          tenant: PILOT,
          body: { cpf: body.cpf, password: body.password },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request('POST', '/auth/customer/login', {
          tenant: OTHER_TENANT,
          body: { cpf: body.cpf, password: body.password },
        })
      ).status,
      401,
    );
  });
  it('exige franquia, nome e senha forte', async () => {
    assert.equal(
      (
        await api.request('POST', '/auth/customer/register', {
          body: { name: 'Teste', cpf: '52998224725', password: 'senha-segura' },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api.request('POST', '/auth/customer/register', {
          tenant: PILOT,
          body: { name: 'A', cpf: '52998224725', password: 'curta' },
        })
      ).status,
      400,
    );
  });
});

describe('resgate concorrente', () => {
  it('duas solicitações diferentes não gastam o mesmo saldo', async () => {
    const user = (await api.request('GET', '/auth/me', { token: customer })).body;
    await api.db.query('update users set points=1200 where id=$1', [user.id]);
    const results = await Promise.all(['concurrent-reward-one', 'concurrent-reward-two'].map(requestKey =>
      api.request('POST', '/customer/rewards', { token: customer, body: { requestKey } }),
    ));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 400]);
    assert.equal((await api.request('GET', '/auth/me', { token: customer })).body.points, 200);
  });
});
