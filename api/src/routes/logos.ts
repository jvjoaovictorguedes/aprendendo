import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../app.js';
import { assertTenantAccess, requireAuth } from '../auth/session.js';
import { transaction } from '../db/pool.js';
import { badRequest, notFound } from '../errors.js';
import { idParams, uuid } from '../validation.js';

export async function logoRoutes(app: FastifyInstance, { db, config }: Deps) {
  const auth = requireAuth(db, config.JWT_SECRET, ['platform_admin', 'tenant_admin']);
  app.post(
    '/admin/tenants/:id/logo',
    { preHandler: auth, bodyLimit: 8 * 1024 * 1024 },
    async (request) => {
      const { id } = idParams.parse(request.params);
      assertTenantAccess(request.auth!, id);
      if (!(await db.query('select id from tenants where id=$1', [id])).rowCount)
        throw notFound('Franquia não encontrada.');
      const { base64 } = z
        .object({
          base64: z
            .string()
            .min(1)
            .max(7 * 1024 * 1024),
        })
        .parse(request.body);
      if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64))
        throw badRequest('Arquivo de imagem inválido.');
      const input = Buffer.from(base64, 'base64');
      if (!input.length || input.length > 5 * 1024 * 1024)
        throw badRequest('Escolha uma imagem de até 5 MB.');
      let output: Buffer;
      let width: number;
      let height: number;
      try {
        const image = sharp(input, { limitInputPixels: 20_000_000, animated: false });
        const metadata = await image.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
          throw new Error('format');
        const result = await image
          .rotate()
          .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82, effort: 4 })
          .toBuffer({ resolveWithObject: true });
        output = result.data;
        width = result.info.width;
        height = result.info.height;
      } catch {
        throw badRequest(
          'Use uma imagem PNG, JPG ou WebP válida, sem animação, de até 20 megapixels.',
        );
      }
      if (output.length > 262144)
        throw badRequest('A imagem ainda está pesada. Escolha uma logo mais simples.');
      const revision = randomUUID();
      const logoUrl = `/public/tenant-logos/${id}/${revision}`;
      await transaction(db, async (client) => {
        // Upload e remoção bloqueiam primeiro a franquia, na mesma ordem.
        if (!(await client.query('select id from tenants where id=$1 for update', [id])).rowCount)
          throw notFound('Franquia não encontrada.');
        await client.query(
          `insert into tenant_logos(tenant_id,content,revision,width,height,updated_by)
        values($1,$2,$3,$4,$5,$6) on conflict(tenant_id) do update set content=excluded.content,
        revision=excluded.revision,width=excluded.width,height=excluded.height,
        updated_by=excluded.updated_by,updated_at=now()`,
          [id, output, revision, width, height, request.auth!.id],
        );
        await client.query('update tenants set logo_url=$2 where id=$1', [id, logoUrl]);
      });
      return { logoUrl, originalBytes: input.length, optimizedBytes: output.length, width, height };
    },
  );
  app.delete('/admin/tenants/:id/logo', { preHandler: auth }, async (request) => {
    const { id } = idParams.parse(request.params);
    assertTenantAccess(request.auth!, id);
    await transaction(db, async (client) => {
      if (
        !(await client.query('update tenants set logo_url=null where id=$1 returning id', [id]))
          .rowCount
      )
        throw notFound('Franquia não encontrada.');
      await client.query('delete from tenant_logos where tenant_id=$1', [id]);
    });
    return { logoUrl: null };
  });
  app.get('/public/tenant-logos/:id/:revision', async (request, reply) => {
    const { id, revision } = z.object({ id: uuid, revision: z.uuid() }).parse(request.params);
    const row = (
      await db.query<{ content: Buffer }>(
        `select l.content from tenant_logos l join tenants t on t.id=l.tenant_id
      where l.tenant_id=$1 and l.revision=$2 and t.status<>'suspensa' and t.logo_url=$3`,
        [id, revision, `/public/tenant-logos/${id}/${revision}`],
      )
    ).rows[0];
    if (!row) throw notFound('Logo não encontrada.');
    return reply
      .type('image/webp')
      .header('Cache-Control', 'public, max-age=3600')
      .header('X-Content-Type-Options', 'nosniff')
      .send(row.content);
  });
}
