import assert from 'node:assert/strict';
import { before, after, it } from 'node:test';
import sharp from 'sharp';
import { startTestApi, ADMIN_EMAIL, ADMIN_PASSWORD, PILOT, OTHER_TENANT } from './helpers.js';
let api: Awaited<ReturnType<typeof startTestApi>>;
let admin: string;
let owner: string;
let image: Buffer;
before(async () => {
  api = await startTestApi();
  admin = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const created = await api.request('POST', '/admin/users', {
    token: admin,
    body: {
      name: 'Logo teste',
      email: 'logo-owner@test.example',
      role: 'tenant_admin',
      tenantId: PILOT,
    },
  });
  owner = await api.login('logo-owner@test.example', created.body.temporaryPassword);
  assert.equal((await api.request('POST', '/auth/change-password', {
    token: owner, body: { currentPassword: created.body.temporaryPassword, newPassword: 'senha-logo-123456' },
  })).status, 200);
  owner = await api.login('logo-owner@test.example', 'senha-logo-123456');
  image = await sharp({
    create: { width: 1200, height: 600, channels: 4, background: '#00884480' },
  })
    .png()
    .toBuffer();
});
after(async () => api.stop());
it('upload exige administrador e isola franquias', async () => {
  const body = { base64: image.toString('base64') };
  assert.equal((await api.request('POST', `/admin/tenants/${PILOT}/logo`, { body })).status, 401);
  assert.equal(
    (await api.request('POST', `/admin/tenants/${OTHER_TENANT}/logo`, { token: owner, body }))
      .status,
    403,
  );
  assert.equal(
    (await api.request('DELETE', `/admin/tenants/${OTHER_TENANT}/logo`, { token: owner })).status,
    403,
  );
});
it('comprime, preserva transparência, serve WebP e substitui sem acumular', async () => {
  const body = { base64: image.toString('base64') };
  const first = await api.request('POST', `/admin/tenants/${PILOT}/logo`, { token: owner, body });
  assert.equal(first.status, 200);
  assert.equal(first.body.width, 512);
  assert.equal(first.body.height, 256);
  assert.ok(first.body.optimizedBytes < image.length);
  const response = await api.app.inject({ method: 'GET', url: first.body.logoUrl });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'image/webp');
  const metadata = await sharp(response.rawPayload).metadata();
  assert.equal(metadata.hasAlpha, true);
  const brand = await api.request('GET', '/public/brand', { tenant: PILOT });
  assert.equal(brand.body.logoUrl, first.body.logoUrl);
  assert.equal(
    (
      await api.request('PATCH', `/admin/tenants/${PILOT}`, {
        token: owner,
        body: { logoUrl: first.body.logoUrl },
      })
    ).status,
    200,
  );
  const second = await api.request('POST', `/admin/tenants/${PILOT}/logo`, { token: admin, body });
  assert.equal(second.status, 200);
  assert.notEqual(second.body.logoUrl, first.body.logoUrl);
  assert.equal((await api.app.inject({ method: 'GET', url: first.body.logoUrl })).statusCode, 404);
  assert.equal(
    (await api.db.query('select count(*)::int as n from tenant_logos where tenant_id=$1', [PILOT]))
      .rows[0].n,
    1,
  );
  assert.equal(
    (await api.request('DELETE', `/admin/tenants/${PILOT}/logo`, { token: owner })).status,
    200,
  );
  assert.equal((await api.app.inject({ method: 'GET', url: second.body.logoUrl })).statusCode, 404);
  assert.equal((await api.request('GET', '/public/brand', { tenant: PILOT })).body.logoUrl, null);
});
it('recusa arquivos falsos, SVG e imagens acima do limite sem alterar a marca', async () => {
  for (const base64 of [
    'not base64',
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>').toString(
      'base64',
    ),
    Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64'),
  ]) {
    assert.equal(
      (
        await api.request('POST', `/admin/tenants/${PILOT}/logo`, {
          token: admin,
          body: { base64 },
        })
      ).status,
      400,
    );
  }
  assert.equal((await api.request('GET', '/public/brand', { tenant: PILOT })).body.logoUrl, null);
});
