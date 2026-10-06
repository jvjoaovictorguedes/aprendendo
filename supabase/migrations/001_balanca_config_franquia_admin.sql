-- ScanMercado — migração 001
-- Etiqueta de balança parametrizável por franquia + painel admin.
--
-- Rode este arquivo UMA vez no SQL Editor do Supabase de um banco que já
-- tem o SCHEMA.sql antigo aplicado. Bancos novos não precisam: o SCHEMA.sql
-- já inclui tudo isto.
--
-- O que muda:
--   1. products ganha "plu" (código do produto na balança) e o barcode
--      passa a ser opcional para produtos vendidos só por peso.
--   2. Nova tabela tenant_settings — tudo que é parametrizável por franquia
--      (layout da etiqueta de balança, regras do app).
--   3. Correções de segurança no RLS:
--      - as políticas "tenant staff manage own ..." deixavam QUALQUER usuário
--        logado da franquia (inclusive cliente) editar catálogo/promoções;
--        agora exigem role tenant_admin.
--      - um usuário conseguia trocar o próprio role para platform_admin
--        editando o próprio profile; agora role/tenant_id só mudam por
--        platform_admin.
--   4. tenant_admin pode editar marca (nome, cor, logo) da própria franquia,
--      mas não plano/status/slug/território.

begin;

-- ============================================================
-- 1. PRODUCTS: PLU da balança
-- ============================================================
alter table public.products alter column barcode drop not null;
alter table public.products add column if not exists plu text;

alter table public.products drop constraint if exists products_barcode_or_plu;
alter table public.products add constraint products_barcode_or_plu
  check (barcode is not null or plu is not null);

-- PLU guardado sem zeros à esquerda ("0123" e "123" são o mesmo produto)
alter table public.products drop constraint if exists products_plu_format;
alter table public.products add constraint products_plu_format
  check (plu is null or plu ~ '^[1-9][0-9]{0,5}$');

create unique index if not exists products_tenant_plu_key
  on public.products (tenant_id, plu) where plu is not null;

-- ============================================================
-- 2. TENANT_SETTINGS
-- ============================================================
create table if not exists public.tenant_settings (
  tenant_id                   uuid primary key references public.tenants(id) on delete cascade,

  -- Etiqueta de balança (EAN-13 de peso variável):
  --   [prefixo][PLU][...][valor][dígito verificador]
  -- O valor sempre termina na posição 12 (logo antes do dígito verificador).
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

-- Toda franquia nova já nasce com configuração padrão
create or replace function public.handle_new_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_settings (tenant_id) values (new.id)
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_tenant_created on public.tenants;
create trigger on_tenant_created
  after insert on public.tenants
  for each row execute function public.handle_new_tenant();

insert into public.tenant_settings (tenant_id)
  select id from public.tenants
  on conflict (tenant_id) do nothing;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenant_settings_touch on public.tenant_settings;
create trigger tenant_settings_touch
  before update on public.tenant_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists products_touch on public.products;
create trigger products_touch
  before update on public.products
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 3. RLS — helper de papel e correções
-- ============================================================
create or replace function public.is_tenant_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'tenant_admin' from public.profiles where id = auth.uid()), false)
$$;

alter table public.tenant_settings enable row level security;

drop policy if exists "platform admin full access to tenant_settings" on public.tenant_settings;
create policy "platform admin full access to tenant_settings"
  on public.tenant_settings for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "tenant admin manages own tenant_settings" on public.tenant_settings;
create policy "tenant admin manages own tenant_settings"
  on public.tenant_settings for all
  using (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
  with check (public.is_tenant_admin() and tenant_id = public.current_tenant_id());

-- O app (mesmo sem login) precisa ler o layout da etiqueta da franquia dele
drop policy if exists "public reads settings of current app tenant" on public.tenant_settings;
create policy "public reads settings of current app tenant"
  on public.tenant_settings for select
  to anon, authenticated
  using (tenant_id = public.request_tenant_id());

-- "tenant staff" passa a exigir tenant_admin (antes valia para cliente também)
drop policy if exists "tenant staff manage own stores" on public.stores;
create policy "tenant staff manage own stores"
  on public.stores for all
  using (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
  with check (public.is_tenant_admin() and tenant_id = public.current_tenant_id());

drop policy if exists "tenant staff manage own products" on public.products;
create policy "tenant staff manage own products"
  on public.products for all
  using (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
  with check (public.is_tenant_admin() and tenant_id = public.current_tenant_id());

drop policy if exists "tenant staff manage own promotions" on public.promotions;
create policy "tenant staff manage own promotions"
  on public.promotions for all
  using (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
  with check (public.is_tenant_admin() and tenant_id = public.current_tenant_id());

drop policy if exists "tenant staff manage own member_promotions" on public.member_promotions;
create policy "tenant staff manage own member_promotions"
  on public.member_promotions for all
  using (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
  with check (public.is_tenant_admin() and tenant_id = public.current_tenant_id());

drop policy if exists "tenant staff manage own notifications" on public.notifications;
create policy "tenant staff manage own notifications"
  on public.notifications for all
  using (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
  with check (public.is_tenant_admin() and tenant_id = public.current_tenant_id());

drop policy if exists "tenant staff manage own catalog_imports" on public.catalog_imports;
create policy "tenant staff manage own catalog_imports"
  on public.catalog_imports for all
  using (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
  with check (public.is_tenant_admin() and tenant_id = public.current_tenant_id());

-- Profile: usuário edita nome etc., mas nunca o próprio role/franquia
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.tenant_id is distinct from old.tenant_id)
     and not public.is_platform_admin()
     and auth.uid() is not null then
    raise exception 'Somente platform_admin pode alterar role ou franquia de um usuário';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ============================================================
-- 4. TENANTS: tenant_admin edita a própria marca
-- ============================================================
drop policy if exists "tenant admin updates own brand" on public.tenants;
create policy "tenant admin updates own brand"
  on public.tenants for update
  using (public.is_tenant_admin() and id = public.current_tenant_id())
  with check (public.is_tenant_admin() and id = public.current_tenant_id());

create or replace function public.guard_tenant_commercial_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() and auth.uid() is not null and (
       new.slug               is distinct from old.slug
    or new.plan               is distinct from old.plan
    or new.status             is distinct from old.status
    or new.exclusivity_region is distinct from old.exclusivity_region
    or new.is_internal        is distinct from old.is_internal
  ) then
    raise exception 'Somente platform_admin pode alterar slug, plano, status ou território da franquia';
  end if;
  return new;
end;
$$;

drop trigger if exists tenants_guard_commercial_fields on public.tenants;
create trigger tenants_guard_commercial_fields
  before update on public.tenants
  for each row execute function public.guard_tenant_commercial_fields();

-- ============================================================
-- 5. SEED: hortifrúti da franquia piloto com PLU de balança
-- ============================================================
update public.products set plu = '1001'
  where tenant_id = '00000000-0000-0000-0000-000000000001' and barcode = '7891000700109';
update public.products set plu = '1002'
  where tenant_id = '00000000-0000-0000-0000-000000000001' and barcode = '7891000700208';

commit;
