import pg from 'pg';

// numeric (preços) vem do pg como string para não perder precisão; aqui
// os valores são pequenos (R$ e kg), então number é seguro.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));

export type Db = pg.Pool;

export function createPool(connectionString: string, max = 10): Db {
  const pool = new pg.Pool({ connectionString, max });
  // Conexão ociosa derrubada pelo servidor (reinício do Postgres, rede):
  // o pool descarta e abre outra; sem este handler o processo cairia.
  pool.on('error', (err) => console.error('conexão com o Postgres perdida:', err.message));
  return pool;
}

/** Executa fn numa transação (commit no sucesso, rollback no erro). */
export async function transaction<T>(db: Db, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
