import { loadConfig } from '../config.js';
import { createPool } from '../db/pool.js';
import { migrate } from '../db/migrate.js';
import { seedDemo, DEMO_TENANT, DEMO_CPF } from '../demo.js';

const config = loadConfig();
if (!config.DEMO_ENABLED || !config.DEMO_OWNER_PASSWORD) {
  throw new Error('Defina DEMO_ENABLED=true e DEMO_OWNER_PASSWORD para preparar a loja fictícia.');
}
const db = createPool(config.DATABASE_URL, 1);
try {
  await migrate(db);
  await seedDemo(db, config.DEMO_OWNER_PASSWORD, process.argv.includes('--reset'));
  console.log(
    `Loja fictícia pronta: ${DEMO_TENANT}. Cliente: ${DEMO_CPF}. Lojista: demo@scanmercado.example.`,
  );
  console.log('A senha do lojista é a configurada no servidor; não a coloque em EXPO_PUBLIC.');
} finally {
  await db.end();
}
