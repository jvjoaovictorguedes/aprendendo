-- Offers remain scoped to a franchise; a null store applies to all its stores.
alter table stores add column active boolean not null default true;
alter table stores add constraint stores_tenant_id_id_key unique (tenant_id, id);
alter table products add constraint products_tenant_id_id_key unique (tenant_id, id);
alter table promotions add column audience text not null default 'all' check (audience in ('all', 'club'));
alter table promotions add column store_id uuid;
alter table promotions add column conditions text not null default '';
alter table promotions add column max_quantity numeric(10,3) check (max_quantity > 0);
alter table promotions add constraint promotions_product_tenant_fk foreign key (tenant_id, product_id) references products(tenant_id, id);
alter table promotions add constraint promotions_store_tenant_fk foreign key (tenant_id, store_id) references stores(tenant_id, id);
alter table promotions add constraint promotions_dates_check check (ends_at is null or ends_at > starts_at);
alter table promotions add constraint promotions_club_percent_check check (audience <> 'club' or kind = 'percent_off');
-- Keep existing exclusive offers and activations when migrating.
insert into promotions (id, tenant_id, product_id, kind, label, percent, starts_at, ends_at, active, audience)
select id, tenant_id, product_id, 'percent_off', label, extra_percent_off, starts_at, ends_at, active, 'club' from member_promotions;
create table promotion_activations (
 user_id uuid not null references users(id) on delete cascade,
 promotion_id uuid not null references promotions(id) on delete cascade,
 activated_at timestamptz not null default now(),
 primary key (user_id, promotion_id)
);
insert into promotion_activations (user_id, promotion_id, activated_at)
select user_id, member_promotion_id, activated_at from member_promotion_activations;
create index promotions_tenant_dates_idx on promotions (tenant_id, starts_at, ends_at) where active;
create table loyalty_settings (
 tenant_id uuid primary key references tenants(id) on delete cascade,
 enabled boolean not null default false,
 reward_name text not null default '',
 points_required integer not null default 1000 check (points_required > 0),
 conditions text not null default '',
 points_per_real numeric(6,2) not null default 1 check (points_per_real > 0 and points_per_real <= 100)
);
create table loyalty_redemptions (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references tenants(id),
 user_id uuid not null references users(id),
 reward_name text not null,
 points_spent integer not null,
 request_key text not null,
 unique(user_id, request_key),
 conditions text not null,
 redeemed_at timestamptz,
 redeemed_by uuid references users(id),
 created_at timestamptz not null default now()
);

create table loyalty_credits (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references tenants(id),
 user_id uuid not null references users(id),
 credited_by uuid not null references users(id),
 receipt text not null,
 purchase_total numeric(10,2) not null check (purchase_total > 0),
 points integer not null check (points > 0),
 created_at timestamptz not null default now(),
 unique(tenant_id, receipt)
);
