-- ScanMercado — schema (PostgreSQL padrão, Railway)
--
-- Aplicado automaticamente pela API no deploy (src/db/migrate.ts) — não
-- precisa rodar à mão. Multi-tenant: um banco para todas as franquias; o
-- isolamento entre franquias é feito pela API (toda consulta filtra pela
-- franquia de quem chama — ver src/auth e src/routes).

-- ============================================================
-- Utilitário: updated_at automático
-- ============================================================
create function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- TENANTS — cada franquia/rede de supermercado
-- ============================================================
create table tenants (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name               text not null check (length(trim(name)) > 0),
  plan               text not null default 'padrao' check (plan in ('padrao', 'pro', 'enterprise')),
  status             text not null default 'em_configuracao' check (status in ('ativa', 'em_configuracao', 'suspensa')),
  accent_color       text not null default '#1DB954' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url           text,
  exclusivity_region text,   -- território com exclusividade contratual (controle comercial)
  is_internal        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger tenants_touch before update on tenants
  for each row execute function touch_updated_at();

-- ============================================================
-- TENANT_SETTINGS — tudo que é parametrizável por franquia
-- ============================================================
create table tenant_settings (
  tenant_id                   uuid primary key references tenants(id) on delete cascade,

  -- Etiqueta de balança (EAN-13 de peso variável):
  --   [prefixo][PLU][...][valor][dígito verificador]
  scale_enabled               boolean not null default true,
  scale_prefix                text    not null default '2'     check (scale_prefix ~ '^[0-9]{1,2}$'),
  scale_plu_length            integer not null default 4       check (scale_plu_length between 1 and 6),
  scale_value_type            text    not null default 'price' check (scale_value_type in ('price', 'weight')),
  scale_value_length          integer not null default 5       check (scale_value_length between 4 and 6),
  scale_value_decimals        integer not null default 2       check (scale_value_decimals between 0 and 3),
  scale_validate_check_digit  boolean not null default true,

  -- Regras do app
  budget_warning_percent      integer not null default 90      check (budget_warning_percent between 50 and 100),
  scan_cooldown_ms            integer not null default 1200    check (scan_cooldown_ms between 300 and 5000),

  updated_at                  timestamptz not null default now(),

  constraint scale_layout_fits_ean13
    check (length(scale_prefix) + scale_plu_length + scale_value_length <= 12)
);

create trigger tenant_settings_touch before update on tenant_settings
  for each row execute function touch_updated_at();

-- Toda franquia nova já nasce com a configuração padrão.
create function create_default_tenant_settings()
returns trigger
language plpgsql
as $$
begin
  insert into tenant_settings (tenant_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger tenants_default_settings after insert on tenants
  for each row execute function create_default_tenant_settings();

-- ============================================================
-- USERS — login próprio (senha em bcrypt, nunca em texto)
--   platform_admin  equipe ScanMercado (sem franquia)
--   tenant_admin    dono/gerente de UMA franquia (entra por e-mail)
--   customer        cliente do app de UMA franquia (entra por CPF)
-- ============================================================
create table users (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid references tenants(id) on delete cascade,
  role                  text not null check (role in ('platform_admin', 'tenant_admin', 'customer')),
  name                  text not null default '',
  email                 text check (email is null or email = lower(email)),
  cpf                   text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  password_hash         text not null,
  points                integer not null default 0 check (points >= 0),
  must_change_password  boolean not null default false,
  disabled_at           timestamptz,
  last_login_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint users_tenant_by_role check (
    (role = 'platform_admin' and tenant_id is null)
    or (role <> 'platform_admin' and tenant_id is not null)
  ),
  constraint users_admin_needs_email check (role = 'customer' or email is not null),
  constraint users_customer_needs_cpf check (role <> 'customer' or cpf is not null)
);

-- Admin entra por e-mail (único na plataforma); cliente entra por CPF
-- (único dentro da franquia — a mesma pessoa pode ser cliente de duas).
create unique index users_admin_email_key on users (email) where role <> 'customer';
create unique index users_tenant_cpf_key on users (tenant_id, cpf) where cpf is not null;
create index users_tenant_role_idx on users (tenant_id, role);

create trigger users_touch before update on users
  for each row execute function touch_updated_at();

-- ============================================================
-- SESSIONS — cada login é uma sessão; o token só vale enquanto a sessão
-- existir. Bloquear usuário ou redefinir senha revoga na hora.
-- ============================================================
create table sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  user_agent  text
);

create index sessions_user_idx on sessions (user_id) where revoked_at is null;

-- ============================================================
-- STORES — lojas físicas
-- ============================================================
create table stores (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  cnpj        text,
  address     text,
  hours       text,
  lat         numeric(9,6),
  lng         numeric(9,6),
  created_at  timestamptz not null default now(),
  unique (tenant_id, cnpj)
);

-- ============================================================
-- PRODUCTS — catálogo por franquia
--   barcode  EAN lido pela câmera (opcional para produto só de balança)
--   plu      código do produto na balança, sem zeros à esquerda
-- ============================================================
create table products (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  barcode         text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  plu             text check (plu is null or plu ~ '^[1-9][0-9]{0,5}$'),
  external_code   text,
  name            text not null check (length(trim(name)) > 0),
  price           numeric(10,2) not null check (price >= 0),   -- unit = 'kg': preço do kg
  unit            text not null check (unit in ('un', 'kg')),
  category        text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint products_barcode_or_plu check (barcode is not null or plu is not null),
  constraint products_kg_needs_plu check (unit <> 'kg' or plu is not null)
);

create unique index products_tenant_barcode_key on products (tenant_id, barcode) where barcode is not null;
create unique index products_tenant_plu_key on products (tenant_id, plu) where plu is not null;
create index products_tenant_name_idx on products (tenant_id, lower(name));

create trigger products_touch before update on products
  for each row execute function touch_updated_at();

-- ============================================================
-- PROMOTIONS — promoções da loja
-- ============================================================
create table promotions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  kind        text not null check (kind in ('percent_off', 'buy_x_pay_y', 'fixed_price')),
  label       text not null,
  percent     numeric(5,2) check (percent is null or percent between 0 and 100),
  buy_qty     integer check (buy_qty is null or buy_qty > 0),
  pay_qty     integer check (pay_qty is null or pay_qty > 0),
  fixed_price numeric(10,2) check (fixed_price is null or fixed_price >= 0),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  active      boolean not null default true,

  constraint promotions_kind_fields check (
    (kind = 'percent_off' and percent is not null)
    or (kind = 'buy_x_pay_y' and buy_qty is not null and pay_qty is not null and pay_qty < buy_qty)
    or (kind = 'fixed_price' and fixed_price is not null)
  )
);

create index promotions_product_idx on promotions (product_id) where active;

-- ============================================================
-- MEMBER_PROMOTIONS — ofertas exclusivas de cliente logado
-- ============================================================
create table member_promotions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  product_id        uuid not null references products(id) on delete cascade,
  label             text not null,
  extra_percent_off numeric(5,2) not null check (extra_percent_off between 0 and 100),
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz,
  active            boolean not null default true
);

create table member_promotion_activations (
  user_id              uuid not null references users(id) on delete cascade,
  member_promotion_id  uuid not null references member_promotions(id) on delete cascade,
  activated_at         timestamptz not null default now(),
  primary key (user_id, member_promotion_id)
);

-- ============================================================
-- FAVORITES / CARRINHO / NOTIFICAÇÕES / IMPORTAÇÃO
-- (hoje o app guarda isso no aparelho; tabelas prontas para sincronizar)
-- ============================================================
create table favorites (
  user_id     uuid not null references users(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table cart_sessions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,   -- null = cliente sem login
  store_id    uuid references stores(id) on delete set null,
  status      text not null default 'open' check (status in ('open', 'checked_out', 'abandoned')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create table cart_items (
  id                   uuid primary key default gen_random_uuid(),
  cart_session_id      uuid not null references cart_sessions(id) on delete cascade,
  product_id           uuid not null references products(id),
  quantity             integer not null check (quantity > 0),
  weight_kg            numeric(10,3),                 -- linhas de etiqueta de balança
  label_code           text,
  unit_price_snapshot  numeric(10,2) not null,
  scanned_at           timestamptz not null default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid references users(id) on delete cascade,   -- null = para todos os clientes da franquia
  kind        text not null check (kind in ('coupon', 'budget', 'system')),
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

create table catalog_imports (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  imported_by    uuid references users(id) on delete set null,
  source_name    text,
  row_count      integer not null default 0,
  error_count    integer not null default 0,
  status         text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at     timestamptz not null default now()
);
