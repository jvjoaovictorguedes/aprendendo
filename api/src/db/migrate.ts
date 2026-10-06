// Aplica as migrações de api/migrations em ordem, cada uma numa transação,
// registrando em schema_migrations — roda sozinho a cada boot da API.
import { readdir, readFile } from 'node:fs/promises';

import type { Db } from './pool.js';

const MIGRATIONS_DIR = new URL('../../migrations/', import.meta.url);

// Trava para dois processos não migrarem ao mesmo tempo (ex.: deploy com
// duas réplicas subindo juntas).
const MIGRATION_LOCK_ID = 727_001;

export async function migrate(db: Db, log: (message: string) => void = console.log): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

  const client = await db.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      create table if not exists schema_migrations (
        name        text primary key,
        applied_at  timestamptz not null default now()
      )
    `);
    const { rows } = await client.query<{ name: string }>('select name from schema_migrations');
    const applied = new Set(rows.map((row) => row.name));

    const pending = files.filter((file) => !applied.has(file));
    for (const file of pending) {
      const sql = await readFile(new URL(file, MIGRATIONS_DIR), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
        log(`migração aplicada: ${file}`);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`Falha na migração ${file}: ${(err as Error).message}`);
      }
    }
    if (pending.length === 0) log('banco em dia, nenhuma migração pendente');
    return pending;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}
