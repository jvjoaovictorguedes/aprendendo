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
