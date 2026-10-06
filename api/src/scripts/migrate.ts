// "npm run migrate": aplica as migrações sem subir o servidor.
import { migrate } from '../db/migrate.js';
import { createPool } from '../db/pool.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL.');
  process.exit(1);
}

const db = createPool(url, 1);
try {
  await migrate(db);
} finally {
  await db.end();
}
