// Sobe um Postgres real em memória (PGlite) atrás de um socket com o
// protocolo do Postgres — a API conecta com o mesmo driver "pg" de produção.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

import { buildApp } from '../src/app.js';
import { bootstrap } from '../src/bootstrap.js';
import { loadConfig } from '../src/config.js';
import { migrate } from '../src/db/migrate.js';
import { createPool } from '../src/db/pool.js';

export const PILOT = '00000000-0000-0000-0000-000000000001';
export const OTHER_TENANT = '00000000-0000-0000-0000-000000000002';
export const ADMIN_EMAIL = 'dono@scanmercado.com.br';
export const ADMIN_PASSWORD = 'senha-forte-123';

let nextPort = 55432 + Math.floor(Math.random() * 1000);

export async function startTestApi() {
  const pglite = await PGlite.create();
  const port = nextPort++;
  const socket = new PGLiteSocketServer({ db: pglite, port, host: '127.0.0.1' });
  await socket.start();

  const config = loadConfig({
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
    JWT_SECRET: 'x'.repeat(40),
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    SEED_DEMO_CUSTOMER: 'true',
  });
  // O socket do PGlite atende uma conexão por vez.
  const db = createPool(config.DATABASE_URL, 1);
  // Limitação do servidor de socket do PGlite (não acontece no Postgres de
  // verdade): depois de um erro de SQL ele derruba a conexão, e a consulta
  // seguinte falha com ECONNRESET. Aqui ela é repetida numa conexão nova.
  const originalQuery = db.query.bind(db) as (...args: unknown[]) => Promise<unknown>;
  (db as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query = async (...args: unknown[]) => {
    try {
      return await originalQuery(...args);
    } catch (err) {
      const message = (err as Error).message ?? '';
      if (/ECONNRESET|Connection terminated|not queryable/i.test(message)) return originalQuery(...args);
      throw err;
    }
  };
  const silent = () => {};
  await migrate(db, silent);
  await bootstrap(db, config, silent);
  const app = await buildApp({ db, config });

  async function request(method: string, url: string, options: { token?: string; body?: unknown; tenant?: string } = {}) {
    const response = await app.inject({
      method: method as 'GET',
      url,
      headers: {
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.tenant ? { 'x-tenant-id': options.tenant } : {}),
      },
      ...(options.body !== undefined ? { payload: options.body as object } : {}),
    });
    return { status: response.statusCode, body: response.body ? JSON.parse(response.body) : null };
  }

  async function login(email: string, password: string) {
    const response = await request('POST', '/auth/login', { body: { email, password } });
    if (response.status !== 200) throw new Error(`login falhou: ${JSON.stringify(response.body)}`);
    return response.body.token as string;
  }

  async function stop() {
    await app.close();
    await db.end();
    await socket.stop();
    await pglite.close();
  }

  return { app, db, config, request, login, stop };
}
