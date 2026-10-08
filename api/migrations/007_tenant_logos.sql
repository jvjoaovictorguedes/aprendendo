-- Uma logo otimizada por franquia; substituições não acumulam arquivos.
create table tenant_logos (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  content bytea not null check (octet_length(content) <= 262144),
  revision uuid not null,
  width integer not null,
  height integer not null,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);
