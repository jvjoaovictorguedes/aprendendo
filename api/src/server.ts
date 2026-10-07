// Inicia a API: aplica migrações, cria o admin principal (se configurado)
// e sobe o servidor. É o "npm start" do Railway.
import { buildApp } from './app.js';
import { bootstrap } from './bootstrap.js';
import { loadConfig } from './config.js';
import { migrate } from './db/migrate.js';
import { createPool } from './db/pool.js';
import { startEngagementWorker } from './engagement.js';

async function main() {
  const config = loadConfig();
  const db = createPool(config.DATABASE_URL);

  await migrate(db);
  await bootstrap(db, config);

  const app = await buildApp({ db, config }, { logger: true });
  const stopWorker = config.PUSH_ENABLED
    ? startEngagementWorker(db, config, (error) =>
        app.log.error({ err: error }, 'Falha na rotina de notificações'),
      )
    : async () => {};

  const shutdown = async () => {
    await stopWorker();
    await app.close();
    await db.end();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
