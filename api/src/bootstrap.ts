// Dados criados no boot a partir de variáveis de ambiente — é o que
// substitui rodar SQL à mão para ter o primeiro acesso.
import { hashPassword } from './auth/password.js';
import type { Config } from './config.js';
import type { Db } from './db/pool.js';
import { seedDemo } from './demo.js';

const PILOT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export async function bootstrap(
  db: Db,
  config: Config,
  log: (message: string) => void = console.log,
) {
  if (config.DEMO_ENABLED) {
    if (!config.DEMO_OWNER_PASSWORD)
      throw new Error('Defina DEMO_OWNER_PASSWORD para preparar a demonstração.');
    await seedDemo(db, config.DEMO_OWNER_PASSWORD);
  }
  if (config.ADMIN_EMAIL && config.ADMIN_PASSWORD) {
    const email = config.ADMIN_EMAIL.trim().toLowerCase();
    // Só cria se não existir: mudar a senha depois é pelo painel
    // (trocar senha / redefinir), nunca sobrescrita a cada deploy.
    const { rowCount } = await db.query(
      `insert into users (role, name, email, password_hash)
       values ('platform_admin', $1, $2, $3)
       on conflict (email) where role <> 'customer' do nothing`,
      [config.ADMIN_NAME, email, await hashPassword(config.ADMIN_PASSWORD)],
    );
    log(rowCount ? `admin principal criado: ${email}` : `admin principal já existe: ${email}`);
  } else {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from users where role = 'platform_admin' and disabled_at is null`,
    );
    if (rows[0].n === 0) {
      log(
        'ATENÇÃO: nenhum platform_admin ativo. Defina ADMIN_EMAIL e ADMIN_PASSWORD e reinicie a API.',
      );
    }
  }

  if (config.SEED_DEMO_CUSTOMER) {
    const { rowCount } = await db.query(
      `insert into users (role, tenant_id, name, cpf, points, password_hash)
       select 'customer', $1, 'Cliente Teste', '12345678900', 1250, $2
       where exists (select 1 from tenants where id = $1)
       on conflict (tenant_id, cpf) where cpf is not null do nothing`,
      [PILOT_TENANT_ID, await hashPassword('123456')],
    );
    if (rowCount) log('cliente de teste criado: CPF 12345678900 / senha 123456 (franquia piloto)');
  }
}
