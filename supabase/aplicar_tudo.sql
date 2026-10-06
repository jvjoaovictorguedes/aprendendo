-- ============================================================
-- ScanMercado — APLICAR TUDO (todas as migrações juntas, em ordem)
--
-- ARQUIVO GERADO a partir de supabase/migrations/ — não edite aqui,
-- edite a migração e gere de novo.
--
-- Use num banco que já tem o SCHEMA.sql: cole este arquivo inteiro no
-- SQL Editor do Supabase e rode. Tudo é idempotente: pode rodar quantas
-- vezes quiser, inclusive se algumas migrações já tinham sido aplicadas.
-- ============================================================


-- >>>>>>>>>> 001_balanca_config_franquia_admin.sql <<<<<<<<<<

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

-- >>>>>>>>>> 002_usuarios_plataforma.sql <<<<<<<<<<

-- ScanMercado — migração 002
-- Gestão de usuários pela plataforma (painel admin → Usuários).
--
-- Rode no SQL Editor depois da 001 (pode rodar de novo sem problema).
--
-- O que muda:
--   1. CORREÇÃO CRÍTICA: handle_new_user lia o "role" de raw_user_meta_data,
--      que é o próprio usuário quem preenche no signUp — qualquer pessoa podia
--      se cadastrar já como platform_admin. Agora o papel vem só de
--      raw_app_meta_data, que só o servidor consegue gravar (funções
--      admin_* da migração 005). Cadastro público sempre nasce customer.
--   2. profiles ganha email (para listar no painel) e disabled_at (bloqueio).
--   3. O guard de privilégios passa a proteger também email e disabled_at.
--   4. CORREÇÃO: duas políticas consultavam "profiles" dentro de uma política
--      de "profiles" → "infinite recursion detected in policy" em qualquer
--      leitura da tabela (o painel nunca conseguia ler o perfil de quem entra).
--      Agora usam is_tenant_admin() (security definer, não passa pelo RLS).

begin;

-- ============================================================
-- 1. PROFILES: email e bloqueio
-- ============================================================
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists disabled_at timestamptz;

update public.profiles p
  set email = u.email
  from auth.users u
  where u.id = p.id and p.email is distinct from u.email;

create index if not exists profiles_tenant_role_idx on public.profiles (tenant_id, role);

-- ============================================================
-- 2. handle_new_user — papel só pelo servidor
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_app_meta_data ->> 'role';
begin
  insert into public.profiles (id, role, tenant_id, name, cpf, email)
  values (
    new.id,
    case when requested_role in ('platform_admin', 'tenant_admin') then requested_role else 'customer' end,
    -- Franquia: a do servidor tem prioridade; cliente comum informa a do app em que se cadastrou.
    coalesce(
      nullif(new.raw_app_meta_data ->> 'tenant_id', ''),
      nullif(new.raw_user_meta_data ->> 'tenant_id', '')
    )::uuid,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'cpf',
    new.email
  );
  return new;
end;
$$;

-- ============================================================
-- 3. Guard: só platform_admin muda papel, franquia, e-mail ou bloqueio
-- ============================================================
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (   new.role        is distinct from old.role
      or new.tenant_id   is distinct from old.tenant_id
      or new.email       is distinct from old.email
      or new.disabled_at is distinct from old.disabled_at)
     and not public.is_platform_admin()
     and auth.uid() is not null then
    raise exception 'Somente platform_admin pode alterar papel, franquia, e-mail ou bloqueio de um usuário';
  end if;
  return new;
end;
$$;

-- Usuário bloqueado deixa de valer como admin, mesmo com sessão antiga ainda válida.
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role = 'platform_admin' and disabled_at is null from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function public.is_tenant_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role = 'tenant_admin' and disabled_at is null from public.profiles where id = auth.uid()),
    false
  )
$$;

-- ============================================================
-- 4. Políticas sem recursão (depois de is_tenant_admin existir)
-- ============================================================
drop policy if exists "tenant admin reads profiles of own tenant" on public.profiles;
create policy "tenant admin reads profiles of own tenant"
  on public.profiles for select
  using (public.is_tenant_admin() and tenant_id = public.current_tenant_id());

drop policy if exists "tenant admin reads cart_sessions of own tenant" on public.cart_sessions;
create policy "tenant admin reads cart_sessions of own tenant"
  on public.cart_sessions for select
  using (public.is_tenant_admin() and tenant_id = public.current_tenant_id());

commit;

-- >>>>>>>>>> 003_cadastro_sem_franquia.sql <<<<<<<<<<

-- ScanMercado — migração 003
-- Corrige "Database error creating new user" ao criar conta pelo painel do
-- Supabase (Authentication → Add user) ou por qualquer cadastro.
--
-- Causas tratadas:
--   1. A regra tenant_required_unless_platform_admin só permitia franquia
--      vazia para platform_admin, mas o trigger cria todo cadastro novo como
--      'customer' sem franquia → insert recusado → conta inteira cancelada.
--      Regra nova: só tenant_admin é obrigado a ter franquia.
--   2. O trigger handle_new_user passa a não derrubar a criação da conta se o
--      profile falhar por qualquer outro motivo: a conta é criada, o erro vai
--      para o log do Postgres (WARNING) e o profile pode ser acertado depois
--      (o script supabase/seed_usuarios_admin.sql faz isso).
--
-- Pode rodar mesmo sem ter rodado a 002 (cria as colunas que faltarem).

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists disabled_at timestamptz;

alter table public.profiles drop constraint if exists tenant_required_unless_platform_admin;
alter table public.profiles drop constraint if exists tenant_admin_requires_tenant;
alter table public.profiles add constraint tenant_admin_requires_tenant
  check (role <> 'tenant_admin' or tenant_id is not null);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_app_meta_data ->> 'role';
begin
  begin
    insert into public.profiles (id, role, tenant_id, name, cpf, email)
    values (
      new.id,
      -- Papel só vem de app_metadata (gravado pelo servidor), nunca do usuário.
      case when requested_role in ('platform_admin', 'tenant_admin') then requested_role else 'customer' end,
      coalesce(
        nullif(new.raw_app_meta_data ->> 'tenant_id', ''),
        nullif(new.raw_user_meta_data ->> 'tenant_id', '')
      )::uuid,
      coalesce(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'cpf', ''),
      new.email
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user: profile de % não foi criado: %', new.email, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Diagnóstico: todos os triggers em auth.users. Deve aparecer só
-- on_auth_user_created (se houver outro, sobrou de um schema antigo).
select tgname as trigger, pg_get_triggerdef(t.oid) as definicao
from pg_trigger t
where tgrelid = 'auth.users'::regclass and not tgisinternal;

-- >>>>>>>>>> 004_marca_publica_do_app.sql <<<<<<<<<<

-- ScanMercado — migração 004
-- Marca da franquia visível para o app do cliente (mesmo sem login).
--
-- A tabela tenants só é legível por admins (tem plano, status, território).
-- O app do cliente precisa só de nome, cor e logo da franquia dele, então
-- expomos exatamente isso por uma função, filtrada pelo header x-tenant-id
-- que o app manda em toda requisição.

create or replace function public.app_brand()
returns table (name text, accent_color text, logo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select t.name, t.accent_color, t.logo_url
  from public.tenants t
  where t.id = public.request_tenant_id()
$$;

revoke all on function public.app_brand() from public;
grant execute on function public.app_brand() to anon, authenticated;

-- >>>>>>>>>> 005_gestao_usuarios_no_banco.sql <<<<<<<<<<

-- ScanMercado — migração 005
-- Gestão de usuários do painel feita no próprio banco (sem Edge Function).
--
-- Antes, criar usuário / redefinir senha / bloquear dependiam da Edge
-- Function admin-users, que precisava de deploy separado — sem ela a tela
-- Usuários não funcionava. Agora são funções do Postgres:
--
--   admin_create_user(email, nome, papel, franquia) → id + senha temporária
--   admin_reset_password(usuario)                   → nova senha temporária
--   admin_set_user_disabled(usuario, bloqueado)     → bloqueia/desbloqueia
--
-- Rodam como security definer (conseguem escrever em auth.users), mas a
-- primeira coisa que cada uma faz é exigir que QUEM CHAMA seja um
-- platform_admin ativo. Anônimo nem consegue executar (sem grant).
-- Pode rodar de novo sem problema.

begin;

-- Senha temporária legível (sem 0/O, 1/l/I). Uso interno.
create or replace function public.generate_temporary_password(p_length integer default 12)
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  bytes bytea := extensions.gen_random_bytes(p_length);
  result text := '';
begin
  for i in 0 .. p_length - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

revoke all on function public.generate_temporary_password(integer) from public, anon, authenticated;

create or replace function public.require_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Somente a equipe da plataforma pode gerenciar usuários.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.require_platform_admin() from public, anon, authenticated;

-- ============================================================
-- Criar usuário do painel
-- ============================================================
create or replace function public.admin_create_user(
  p_email     text,
  p_name      text,
  p_role      text,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email    text := lower(trim(p_email));
  v_user_id  uuid := gen_random_uuid();
  v_password text;
begin
  perform public.require_platform_admin();

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'E-mail inválido.';
  end if;
  if p_role not in ('platform_admin', 'tenant_admin') then
    raise exception 'Papel inválido: use platform_admin ou tenant_admin.';
  end if;
  if p_role = 'tenant_admin' and p_tenant_id is null then
    raise exception 'Administrador de franquia precisa de uma franquia.';
  end if;
  if p_role = 'tenant_admin' and not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'Franquia não encontrada.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Já existe uma conta com esse e-mail.' using errcode = '23505';
  end if;
  if p_role = 'platform_admin' then
    p_tenant_id := null;
  end if;

  v_password := public.generate_temporary_password();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                       'role', p_role, 'tenant_id', p_tenant_id),
    jsonb_build_object('name', coalesce(trim(p_name), '')),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text, 'email',
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    null, now(), now()
  );

  -- O trigger handle_new_user já cria o profile; isto garante papel/franquia
  -- mesmo que o trigger esteja numa versão antiga.
  insert into public.profiles (id, role, tenant_id, name, email)
    values (v_user_id, p_role, p_tenant_id, coalesce(trim(p_name), ''), v_email)
  on conflict (id) do update
    set role = excluded.role,
        tenant_id = excluded.tenant_id,
        name = excluded.name,
        email = excluded.email,
        disabled_at = null;

  return jsonb_build_object('user_id', v_user_id, 'temporary_password', v_password);
end;
$$;

-- ============================================================
-- Redefinir senha (encerra as sessões abertas)
-- ============================================================
create or replace function public.admin_reset_password(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_password text;
begin
  perform public.require_platform_admin();

  v_password := public.generate_temporary_password();
  update auth.users
    set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
        updated_at = now()
    where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  delete from auth.sessions where user_id = p_user_id;
  return v_password;
end;
$$;

-- ============================================================
-- Bloquear / desbloquear (bloqueio derruba as sessões na hora)
-- ============================================================
create or replace function public.admin_set_user_disabled(p_user_id uuid, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_platform_admin();

  if p_user_id = auth.uid() then
    raise exception 'Você não pode bloquear a própria conta.';
  end if;

  update auth.users
    set banned_until = case when p_disabled then now() + interval '100 years' else null end,
        updated_at = now()
    where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  update public.profiles
    set disabled_at = case when p_disabled then now() else null end
    where id = p_user_id;

  if p_disabled then
    delete from auth.sessions where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_create_user(text, text, text, uuid) from public, anon;
revoke all on function public.admin_reset_password(uuid) from public, anon;
revoke all on function public.admin_set_user_disabled(uuid, boolean) from public, anon;
grant execute on function public.admin_create_user(text, text, text, uuid) to authenticated;
grant execute on function public.admin_reset_password(uuid) to authenticated;
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;

commit;

