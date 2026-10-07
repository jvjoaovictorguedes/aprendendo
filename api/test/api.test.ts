import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { migrate } from '../src/db/migrate.js';
import { ADMIN_EMAIL, ADMIN_PASSWORD, OTHER_TENANT, PILOT, startTestApi } from './helpers.js';

let api: Awaited<ReturnType<typeof startTestApi>>;
let adminToken: string;

before(async () => {
  api = await startTestApi();
  adminToken = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
});
after(async () => api.stop());

describe('boot', () => {
  it('migrações rodam de novo sem aplicar nada (idempotente)', async () => {
    assert.deepEqual(await migrate(api.db, () => {}), []);
  });

  it('health responde', async () => {
    assert.equal((await api.request('GET', '/health')).status, 200);
  });

  it('admin principal criado pelas variáveis de ambiente', async () => {
    const me = await api.request('GET', '/auth/me', { token: adminToken });
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'platform_admin');
    assert.equal(me.body.email, ADMIN_EMAIL);
  });
});

describe('app do cliente (público)', () => {
  it('marca da franquia do header', async () => {
    const brand = await api.request('GET', '/public/brand', { tenant: PILOT });
    assert.deepEqual(brand.body, { name: 'ScanMercado', accentColor: '#1DB954', logoUrl: null });
  });

  it('sem header de franquia é recusado', async () => {
    assert.equal((await api.request('GET', '/public/brand')).status, 400);
  });

  it('configuração da balança padrão', async () => {
    const settings = await api.request('GET', '/public/settings', { tenant: PILOT });
    assert.equal(settings.body.scale.prefix, '2');
    assert.equal(settings.body.scale.valueType, 'price');
  });

  it('produto por código de barras com promoção', async () => {
    const product = await api.request('GET', '/public/products/barcode/7891000200104', { tenant: PILOT });
    assert.equal(product.status, 200);
    assert.equal(product.body.name, 'Leite Integral 1L');
    assert.equal(product.body.promotion.kind, 'buyXPayY');
    assert.equal(product.body.promotion.buy, 3);
    assert.equal(product.body.promotion.pay, 2);
    assert.equal(product.body.promotion.label, 'Leve 3 Pague 2');
    assert.equal(product.body.promotion.maxQuantity, null);
    assert.ok(product.body.promotion.id);
    assert.ok(product.body.promotion.startsAt);
  });

  it('produto pelo PLU da balança (zeros à esquerda não importam)', async () => {
    const product = await api.request('GET', '/public/products/plu/01001', { tenant: PILOT });
    assert.equal(product.body.name, 'Maçã Gala (kg)');
    assert.equal(product.body.unit, 'kg');
  });

  it('produto de outra franquia não aparece', async () => {
    const product = await api.request('GET', '/public/products/barcode/7891000200104', { tenant: OTHER_TENANT });
    assert.equal(product.status, 404);
  });

  it('cliente entra com CPF e senha', async () => {
    const login = await api.request('POST', '/auth/customer/login', {
      tenant: PILOT,
      body: { cpf: '123.456.789-00', password: '123456' },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, 'customer');
    assert.equal(login.body.user.points, 1250);
  });

  it('cliente de uma franquia não entra pelo app de outra', async () => {
    const login = await api.request('POST', '/auth/customer/login', {
      tenant: OTHER_TENANT,
      body: { cpf: '12345678900', password: '123456' },
    });
    assert.equal(login.status, 401);
  });
});

describe('login e sessões', () => {
  it('senha errada é recusada com mensagem genérica', async () => {
    const response = await api.request('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: 'errada' } });
    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Login ou senha incorretos.');
  });

  it('cliente não entra pelo login do painel', async () => {
    const response = await api.request('POST', '/auth/login', { body: { email: 'x@x.com', password: '123456' } });
    assert.equal(response.status, 401);
  });

  it('sem token as rotas de admin são recusadas', async () => {
    assert.equal((await api.request('GET', '/admin/tenants')).status, 401);
  });

  it('logout invalida o token na hora', async () => {
    const token = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    assert.equal((await api.request('POST', '/auth/logout', { token })).status, 200);
    assert.equal((await api.request('GET', '/auth/me', { token })).status, 401);
  });

  it('muitas tentativas erradas bloqueiam temporariamente', async () => {
    const body = { email: 'alvo@x.com', password: 'errada' };
    for (let i = 0; i < 10; i += 1) await api.request('POST', '/auth/login', { body });
    assert.equal((await api.request('POST', '/auth/login', { body })).status, 429);
  });
});

describe('gestão de usuários', () => {
  let lojistaId: string;
  let lojistaToken: string;

  it('platform_admin cria lojista com senha temporária', async () => {
    const created = await api.request('POST', '/admin/users', {
      token: adminToken,
      body: { email: 'Lojista@Mercado.com', name: 'Lojista', role: 'tenant_admin', tenantId: PILOT },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.user.email, 'lojista@mercado.com');
    assert.equal(created.body.user.tenantName, 'ScanMercado');
    assert.equal(created.body.temporaryPassword.length, 12);
    lojistaId = created.body.user.id;

    lojistaToken = await api.login('lojista@mercado.com', created.body.temporaryPassword);
    const me = await api.request('GET', '/auth/me', { token: lojistaToken });
    assert.equal(me.body.mustChangePassword, true);
    // Com a senha temporária, o painel fica bloqueado até a troca.
    const blocked = await api.request('GET', '/admin/tenants', { token: lojistaToken });
    assert.equal(blocked.status, 403);
  });

  it('e-mail repetido é recusado', async () => {
    const response = await api.request('POST', '/admin/users', {
      token: adminToken,
      body: { email: 'lojista@mercado.com', role: 'tenant_admin', tenantId: PILOT },
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.error, 'Já existe uma conta com esse e-mail.');
  });

  it('lojista sem franquia é recusado', async () => {
    const response = await api.request('POST', '/admin/users', {
      token: adminToken,
      body: { email: 'semfranquia@x.com', role: 'tenant_admin' },
    });
    assert.equal(response.status, 400);
  });

  it('lojista troca a senha temporária', async () => {
    const tempLogin = await api.request('POST', '/auth/change-password', {
      token: lojistaToken,
      body: { currentPassword: 'errada', newPassword: 'nova-senha-123' },
    });
    assert.equal(tempLogin.status, 400);
  });

  it('lojista NÃO gerencia usuários', async () => {
    assert.equal((await api.request('GET', '/admin/users', { token: lojistaToken })).status, 403);
    const create = await api.request('POST', '/admin/users', {
      token: lojistaToken,
      body: { email: 'z@z.com', role: 'platform_admin' },
    });
    assert.equal(create.status, 403);
  });

  it('platform_admin lista e filtra usuários', async () => {
    const all = await api.request('GET', '/admin/users', { token: adminToken });
    assert.ok(all.body.length >= 2);
    assert.ok(all.body.every((user: { role: string }) => user.role !== 'customer'));
    const withCustomers = await api.request('GET', `/admin/users?tenantId=${PILOT}&includeCustomers=true`, { token: adminToken });
    assert.ok(withCustomers.body.some((user: { role: string }) => user.role === 'customer'));
  });

  it('admin não muda o próprio papel nem se bloqueia', async () => {
    const me = await api.request('GET', '/auth/me', { token: adminToken });
    const patch = await api.request('PATCH', `/admin/users/${me.body.id}`, {
      token: adminToken,
      body: { role: 'tenant_admin', tenantId: PILOT },
    });
    assert.equal(patch.status, 400);
    const block = await api.request('POST', `/admin/users/${me.body.id}/disable`, {
      token: adminToken,
      body: { disabled: true },
    });
    assert.equal(block.status, 400);
  });

  it('redefinir senha derruba as sessões e a nova senha funciona', async () => {
    const reset = await api.request('POST', `/admin/users/${lojistaId}/reset-password`, { token: adminToken });
    assert.equal(reset.status, 200);
    assert.equal((await api.request('GET', '/auth/me', { token: lojistaToken })).status, 401);
    lojistaToken = await api.login('lojista@mercado.com', reset.body.temporaryPassword);
    const changed = await api.request('POST', '/auth/change-password', {
      token: lojistaToken,
      body: { currentPassword: reset.body.temporaryPassword, newPassword: 'nova-senha-123' },
    });
    assert.equal(changed.status, 200);
    const me = await api.request('GET', '/auth/me', { token: lojistaToken });
    assert.equal(me.body.mustChangePassword, false);
  });

  it('bloquear tira o acesso na hora; desbloquear devolve', async () => {
    const block = await api.request('POST', `/admin/users/${lojistaId}/disable`, {
      token: adminToken,
      body: { disabled: true },
    });
    assert.equal(block.body.disabled, true);
    assert.equal((await api.request('GET', '/admin/tenants', { token: lojistaToken })).status, 401);
    const login = await api.request('POST', '/auth/login', {
      body: { email: 'lojista@mercado.com', password: 'nova-senha-123' },
    });
    assert.equal(login.status, 401);
    assert.equal(login.body.error, 'Este acesso está bloqueado.');

    await api.request('POST', `/admin/users/${lojistaId}/disable`, { token: adminToken, body: { disabled: false } });
    lojistaToken = await api.login('lojista@mercado.com', 'nova-senha-123');
  });

  describe('o que o lojista pode fazer', () => {
    it('vê só a própria franquia', async () => {
      const tenants = await api.request('GET', '/admin/tenants', { token: lojistaToken });
      assert.deepEqual(tenants.body.map((tenant: { id: string }) => tenant.id), [PILOT]);
      assert.equal((await api.request('GET', `/admin/tenants/${OTHER_TENANT}`, { token: lojistaToken })).status, 403);
    });

    it('edita marca da própria franquia, mas não o plano', async () => {
      const brand = await api.request('PATCH', `/admin/tenants/${PILOT}`, {
        token: lojistaToken,
        body: { accentColor: '#d7263d', name: 'Mercado Piloto' },
      });
      assert.equal(brand.status, 200);
      assert.equal(brand.body.accentColor, '#D7263D');
      const plan = await api.request('PATCH', `/admin/tenants/${PILOT}`, { token: lojistaToken, body: { plan: 'enterprise' } });
      assert.equal(plan.status, 403);
      const publicBrand = await api.request('GET', '/public/brand', { tenant: PILOT });
      assert.equal(publicBrand.body.name, 'Mercado Piloto');
    });

    it('configura a balança e valida o layout', async () => {
      const current = await api.request('GET', `/admin/tenants/${PILOT}/settings`, { token: lojistaToken });
      const ok = await api.request('PUT', `/admin/tenants/${PILOT}/settings`, {
        token: lojistaToken,
        body: { ...current.body, scale: { ...current.body.scale, valueType: 'weight', valueDecimals: 3, pluLength: 5 } },
      });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.scale.pluLength, 5);
      const invalid = await api.request('PUT', `/admin/tenants/${PILOT}/settings`, {
        token: lojistaToken,
        body: { ...current.body, scale: { ...current.body.scale, prefix: '20', pluLength: 6, valueLength: 6 } },
      });
      assert.equal(invalid.status, 400);
      assert.equal((await api.request('GET', `/admin/tenants/${OTHER_TENANT}/settings`, { token: lojistaToken })).status, 403);
    });

    it('cadastra e edita produto de balança; PLU repetido é recusado', async () => {
      const created = await api.request('POST', `/admin/tenants/${PILOT}/products`, {
        token: lojistaToken,
        body: { name: 'Tomate (kg)', category: 'Hortifruti', plu: '0042', price: 6.5, unit: 'kg' },
      });
      assert.equal(created.status, 201);
      assert.equal(created.body.plu, '42');
      assert.equal(created.body.barcode, null);

      const byPlu = await api.request('GET', '/public/products/plu/42', { tenant: PILOT });
      assert.equal(byPlu.body.barcode, 'plu:42');

      const duplicate = await api.request('POST', `/admin/tenants/${PILOT}/products`, {
        token: lojistaToken,
        body: { name: 'Outro', category: 'X', plu: '42', price: 1, unit: 'kg' },
      });
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.body.error, 'Já existe um produto com esse PLU nesta franquia.');

      const kgWithoutPlu = await api.request('POST', `/admin/tenants/${PILOT}/products`, {
        token: lojistaToken,
        body: { name: 'Sem PLU', category: 'X', barcode: '7890000000001', price: 1, unit: 'kg' },
      });
      assert.equal(kgWithoutPlu.status, 400);

      const updated = await api.request('PUT', `/admin/products/${created.body.id}`, {
        token: lojistaToken,
        body: { ...created.body, price: 7.25, active: false },
      });
      assert.equal(updated.body.price, 7.25);
      assert.equal((await api.request('GET', '/public/products/plu/42', { tenant: PILOT })).status, 404);
    });

    it('busca produtos por nome, EAN e PLU', async () => {
      const byName = await api.request('GET', `/admin/tenants/${PILOT}/products?search=maçã`, { token: lojistaToken });
      assert.equal(byName.body[0].name, 'Maçã Gala (kg)');
      const byPlu = await api.request('GET', `/admin/tenants/${PILOT}/products?search=1002`, { token: lojistaToken });
      assert.equal(byPlu.body[0].name, 'Banana Prata (kg)');
      const byPluTool = await api.request('GET', `/admin/tenants/${PILOT}/products/plu/01001`, { token: lojistaToken });
      assert.equal(byPluTool.body.name, 'Maçã Gala (kg)');
    });

    it('não mexe em produto de outra franquia', async () => {
      const other = await api.request('POST', `/admin/tenants/${OTHER_TENANT}/products`, {
        token: adminToken,
        body: { name: 'Produto Sul', category: 'X', barcode: '7890000000099', price: 2, unit: 'un' },
      });
      assert.equal(other.status, 201);
      assert.equal((await api.request('GET', `/admin/products/${other.body.id}`, { token: lojistaToken })).status, 403);
      const edit = await api.request('PUT', `/admin/products/${other.body.id}`, {
        token: lojistaToken,
        body: { ...other.body, price: 0 },
      });
      assert.equal(edit.status, 403);
    });

    it('não cria franquia', async () => {
      const response = await api.request('POST', '/admin/tenants', {
        token: lojistaToken,
        body: { name: 'X', slug: 'x' },
      });
      assert.equal(response.status, 403);
    });
  });
});

describe('franquias (plataforma)', () => {
  it('cria franquia já com configuração padrão', async () => {
    const created = await api.request('POST', '/admin/tenants', {
      token: adminToken,
      body: { name: 'Mercado Bom Preço', slug: 'bom-preco', plan: 'pro' },
    });
    assert.equal(created.status, 201);
    const settings = await api.request('GET', `/admin/tenants/${created.body.id}/settings`, { token: adminToken });
    assert.equal(settings.status, 200);
    const duplicate = await api.request('POST', '/admin/tenants', {
      token: adminToken,
      body: { name: 'Outro', slug: 'bom-preco' },
    });
    assert.equal(duplicate.status, 409);
  });

  it('altera plano, status e território', async () => {
    const response = await api.request('PATCH', `/admin/tenants/${OTHER_TENANT}`, {
      token: adminToken,
      body: { plan: 'enterprise', status: 'suspensa', exclusivityRegion: 'Porto Alegre' },
    });
    assert.equal(response.body.plan, 'enterprise');
    assert.equal(response.body.status, 'suspensa');

    // Franquia suspensa não aceita cadastro nem login de cliente no app.
    const register = await api.request('POST', '/auth/customer/register', {
      tenant: OTHER_TENANT,
      body: { name: 'Cliente', cpf: '52998224725', password: 'senha-segura' },
    });
    assert.equal(register.status, 403);
    const login = await api.request('POST', '/auth/customer/login', {
      tenant: OTHER_TENANT,
      body: { cpf: '52998224725', password: 'senha-segura' },
    });
    assert.equal(login.status, 403);
  });

  it('logo da franquia só aceita endereço http(s)', async () => {
    const response = await api.request('PATCH', `/admin/tenants/${PILOT}`, {
      token: adminToken,
      body: { logoUrl: 'javascript:alert(1)' },
    });
    assert.equal(response.status, 400);
  });
});
