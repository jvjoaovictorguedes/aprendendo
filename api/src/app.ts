import cors from '@fastify/cors';
import Fastify, { type FastifyServerOptions } from 'fastify';

import { LoginRateLimiter } from './auth/rateLimit.js';
import type { Config } from './config.js';
import type { Db } from './db/pool.js';
import { registerErrorHandler } from './errors.js';
import { adminTenantRoutes } from './routes/adminTenants.js';
import { adminUserRoutes } from './routes/adminUsers.js';
import { authRoutes } from './routes/auth.js';
import { offerRoutes } from './routes/offers.js';
import { publicRoutes } from './routes/public.js';
import { engagementRoutes } from './routes/engagement.js';
import { demoRoutes } from './routes/demo.js';

export type Deps = {
  db: Db;
  config: Config;
  limiter: LoginRateLimiter;
};

export async function buildApp(
  { db, config }: { db: Db; config: Config },
  options: FastifyServerOptions = {},
) {
  // trustProxy: no Railway a API fica atrás do proxy deles — o IP real
  // (usado no limite de tentativas de login) vem no X-Forwarded-For. Só os
  // últimos TRUST_PROXY_HOPS endereços são confiáveis; o resto vem do cliente.
  const app = Fastify({ trustProxy: config.TRUST_PROXY_HOPS || false, ...options });
  const deps: Deps = { db, config, limiter: new LoginRateLimiter() };

  const origins = config.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: origins.length > 0 ? origins : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-tenant-id'],
  });

  app.decorateRequest('auth', null);
  registerErrorHandler(app);

  app.get('/health', async () => {
    await db.query('select 1');
    return { ok: true };
  });

  await app.register(async (scope) => publicRoutes(scope, deps), {
    prefix: '/public',
  });
  await app.register(async (scope) => authRoutes(scope, deps), {
    prefix: '/auth',
  });
  await app.register(async (scope) => adminTenantRoutes(scope, deps), {
    prefix: '/admin',
  });
  await app.register(async (scope) => adminUserRoutes(scope, deps), {
    prefix: '/admin',
  });

  await app.register(async (scope) => offerRoutes(scope, deps));
  await app.register(async (scope) => engagementRoutes(scope, deps), {
    prefix: '/customer',
  });
  await app.register(async (scope) => demoRoutes(scope, deps));

  return app;
}
