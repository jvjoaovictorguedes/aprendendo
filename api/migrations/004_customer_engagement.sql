-- Consentimento explícito, compras declaradas e fila de notificações.
alter table promotions add constraint promotions_tenant_id_id_key unique(tenant_id,id);
create table notification_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  cart_reminders boolean not null default false,
  personalized_offers boolean not null default false,
  updated_at timestamptz not null default now(),
  last_evaluated_at timestamptz not null default 'epoch'
);

create table push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  installation_id text not null,
  token text not null unique,
  platform text not null check(platform in ('android', 'ios')),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(user_id, installation_id)
);

create table customer_carts (
  user_id uuid primary key references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  store_id uuid,
  cart_key text not null,
  revision bigint not null,
  items jsonb not null default '[]',
  last_activity_at timestamptz not null default now(),
  status text not null default 'active' check(status in ('active','closed')),
  foreign key(tenant_id, store_id) references stores(tenant_id, id)
);

create table customer_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  store_id uuid,
  request_key text not null,
  cart_key text not null,
  source text not null default 'self_reported' check(source='self_reported'),
  purchased_at timestamptz not null default now(),
  unique(user_id, request_key),
  unique(user_id, cart_key),
  foreign key(tenant_id, store_id) references stores(tenant_id, id)
);
create table customer_purchase_items (
  purchase_id uuid not null references customer_purchases(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  product_id uuid not null,
  quantity numeric(12,3) not null check(quantity>0),
  primary key(purchase_id, product_id),
  foreign key(tenant_id, product_id) references products(tenant_id, id)
);
create index customer_purchases_recent on customer_purchases(user_id, purchased_at desc);

create table customer_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check(kind in ('cart','offer')),
  dedupe_key text not null,
  title text not null,
  body text not null,
  offer_id uuid,
  cart_key text,
  rule_version text not null default 'rules-v1',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  opened_at timestamptz,
  unique(user_id, dedupe_key),
  foreign key(tenant_id, offer_id) references promotions(tenant_id, id)
);

create table push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references customer_notifications(id) on delete cascade,
  device_id uuid not null references push_devices(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','sending','ticket','delivered','cancelled','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  ticket_id text,
  sent_token text,
  ticket_at timestamptz,
  error_code text,
  unique(notification_id, device_id)
);
create index push_deliveries_due on push_deliveries(status, next_attempt_at);
