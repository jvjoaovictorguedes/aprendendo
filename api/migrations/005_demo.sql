alter table tenants add column is_demo boolean not null default false;
create table demo_checkouts (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references tenants(id),
 user_id uuid not null references users(id),
 request_key text not null,
 summary jsonb not null,
 created_at timestamptz not null default now(),
 unique(user_id,request_key)
);
