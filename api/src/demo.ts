import type { Db } from './db/pool.js';
import { transaction } from './db/pool.js';
import { hashPassword } from './auth/password.js';
import { badRequest } from './errors.js';

export const DEMO_TENANT = '55555555-5555-4555-8555-555555555555';
export const DEMO_CUSTOMER = '55555555-5555-4555-8555-555555555552';
export const DEMO_OWNER = '55555555-5555-4555-8555-555555555553';
export const DEMO_CPF = '52998224725';
export const DEMO_CUSTOMER_PASSWORD = 'demo-cliente-2026';
export function ean(body: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 ? 3 : 1);
  return body + ((10 - (sum % 10)) % 10);
}
export const DEMO_PRODUCTS = [
  { name: 'Arroz Branco 5kg', price: 24.9, category: 'Mercearia' },
  { name: 'Feijão Carioca 1kg', price: 8.49, category: 'Mercearia' },
  { name: 'Leite Integral 1L', price: 5.49, category: 'Laticínios' },
  { name: 'Café Torrado 500g', price: 14.5, category: 'Mercearia' },
  { name: 'Óleo de Soja 900ml', price: 7.99, category: 'Mercearia' },
  { name: 'Refrigerante Cola 2L', price: 9.99, category: 'Bebidas' },
  { name: 'Detergente 500ml', price: 2.79, category: 'Limpeza' },
  { name: 'Papel Higiênico 12 rolos', price: 23.9, category: 'Higiene' },
  {
    name: 'Banana Prata (kg)',
    price: 5.49,
    category: 'Hortifruti',
    plu: '101',
  },
  { name: 'Contrafilé (kg)', price: 37.9, category: 'Açougue', plu: '100' },
].map((p, i) => ({
  ...p,
  barcode: ean(`789900${String(i + 1).padStart(6, '0')}`),
  unit: p.plu ? 'kg' : 'un',
}));

export async function seedDemo(db: Db, ownerPassword: string, reset = false) {
  const ownerHash = await hashPassword(ownerPassword),
    customerHash = await hashPassword(DEMO_CUSTOMER_PASSWORD);
  await transaction(db, async (client) => {
    await client.query('select pg_advisory_xact_lock(72916413)');
    const existing = (await client.query('select is_demo from tenants where id=$1', [DEMO_TENANT]))
      .rows[0];
    if (existing && !existing.is_demo)
      throw badRequest('Esta franquia não é um ambiente de demonstração.');
    if (existing && !reset) return;
    await client.query(
      `insert into tenants(id,slug,name,status,accent_color,is_internal,is_demo)
   values($1,'demonstracao','Mercado Demonstração','ativa','#16B653',true,true)
   on conflict(id) do update set name='Mercado Demonstração',accent_color='#16B653',logo_url=null,status='ativa'`,
      [DEMO_TENANT],
    );
    if (reset) {
      for (const table of [
        'customer_notifications',
        'customer_purchases',
        'customer_carts',
        'push_devices',
        'notification_preferences',
        'loyalty_redemptions',
        'loyalty_credits',
        'demo_checkouts',
        'cart_sessions',
        'notifications',
        'catalog_imports',
      ])
        await client.query(`delete from ${table} where tenant_id=$1`, [DEMO_TENANT]);
      await client.query('delete from promotions where tenant_id=$1', [DEMO_TENANT]);
      await client.query('update stores set active=false where tenant_id=$1', [DEMO_TENANT]);
      await client.query('delete from products where tenant_id=$1', [
        DEMO_TENANT,
      ]);
      await client.query('update sessions set revoked_at=now() where user_id=$1', [DEMO_CUSTOMER]);
    }
    await client.query(
      `insert into stores(id,tenant_id,name,address,hours,active)
   values('55555555-5555-4555-8555-555555555551',$1,'Loja de demonstração','Endereço fictício · Uberlândia, MG','Segunda a sábado, 8h às 20h',true)
   on conflict(id) do update set name=excluded.name,address=excluded.address,hours=excluded.hours,active=true`,
      [DEMO_TENANT],
    );
    for (const p of DEMO_PRODUCTS)
      await client.query(
        `insert into products(tenant_id,barcode,plu,name,price,unit,category)
    values($1,$2,$3,$4,$5,$6,$7) on conflict(tenant_id,barcode) where barcode is not null
    do update set plu=$3,name=$4,price=$5,unit=$6,category=$7,active=true`,
        [DEMO_TENANT, p.barcode, p.plu ?? null, p.name, p.price, p.unit, p.category],
      );
    const offers = [
      {
        index: 0,
        label: 'Clube: 10% no arroz',
        kind: 'percent_off',
        audience: 'club',
        percent: 10,
        limit: 2,
      },
      {
        index: 1,
        label: 'Feijão com 15% de desconto',
        kind: 'percent_off',
        audience: 'all',
        percent: 15,
        limit: 4,
      },
      {
        index: 2,
        label: 'Leve 3 leites, pague 2',
        kind: 'buy_x_pay_y',
        audience: 'all',
        buy: 3,
        pay: 2,
        limit: 6,
      },
      {
        index: 5,
        label: 'Refrigerante por R$ 6,99',
        kind: 'fixed_price',
        audience: 'all',
        fixed: 6.99,
        limit: 3,
      },
    ];
    for (const o of offers)
      await client.query(
        `insert into promotions(tenant_id,product_id,label,kind,audience,percent,buy_qty,pay_qty,fixed_price,max_quantity,starts_at,ends_at,conditions)
    select $1,id,$3,$4,$5,$6,$7,$8,$9,$10,now()-interval '1 hour',now()+interval '30 days','Oferta fictícia para apresentação. Confira os limites.'
    from products where tenant_id=$1 and barcode=$2`,
        [
          DEMO_TENANT,
          DEMO_PRODUCTS[o.index].barcode,
          o.label,
          o.kind,
          o.audience,
          'percent' in o ? o.percent : null,
          'buy' in o ? o.buy : null,
          'pay' in o ? o.pay : null,
          'fixed' in o ? o.fixed : null,
          o.limit,
        ],
      );
    await client.query(
      `update tenant_settings set scale_prefix='20',scale_plu_length=5,scale_value_type='price',scale_value_length=5,scale_value_decimals=2,scale_enabled=true,scale_validate_check_digit=true,scan_cooldown_ms=1500,budget_warning_percent=90 where tenant_id=$1`,
      [DEMO_TENANT],
    );
    await client.query(
      `insert into users(id,tenant_id,role,name,cpf,password_hash,points) values($1,$2,'customer','Cliente Demonstração',$3,$4,1250)
   on conflict(id) do update set name='Cliente Demonstração',points=1250,password_hash=$4,disabled_at=null,must_change_password=false`,
      [DEMO_CUSTOMER, DEMO_TENANT, DEMO_CPF, customerHash],
    );
    await client.query(
      `insert into users(id,tenant_id,role,name,email,password_hash) values($1,$2,'tenant_admin','Lojista Demonstração','demo@scanmercado.example',$3)
   on conflict(id) do update set name='Lojista Demonstração',password_hash=$3,disabled_at=null,must_change_password=false`,
      [DEMO_OWNER, DEMO_TENANT, ownerHash],
    );
    await client.query(
      `insert into loyalty_settings(tenant_id,enabled,reward_name,points_required,conditions,points_per_real)
   values($1,true,'Café no balcão (simulação)',1000,'Benefício fictício. Nenhuma entrega ou compra real.',1)
   on conflict(tenant_id) do update set enabled=true,reward_name=excluded.reward_name,points_required=1000,conditions=excluded.conditions,points_per_real=1`,
      [DEMO_TENANT],
    );
  });
}
