-- ScanMercado — migração 002
-- Gestão de usuários pela plataforma (painel admin → Usuários).
--
-- Rode UMA vez no SQL Editor, depois da 001.
--
-- O que muda:
--   1. CORREÇÃO CRÍTICA: handle_new_user lia o "role" de raw_user_meta_data,
--      que é o próprio usuário quem preenche no signUp — qualquer pessoa podia
--      se cadastrar já como platform_admin. Agora o papel vem só de
--      raw_app_meta_data, que só o servidor (service_role, Edge Function
--      admin-users) consegue gravar. Cadastro público sempre nasce customer.
--   2. profiles ganha email (para listar no painel) e disabled_at (bloqueio).
--   3. O guard de privilégios passa a proteger também email e disabled_at.

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

commit;
