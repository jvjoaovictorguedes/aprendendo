-- ScanMercado — migração 003
-- Corrige "Database error creating new user" ao criar conta pelo painel do
-- Supabase (Authentication → Add user) ou por qualquer cadastro sem franquia.
--
-- Causa: o trigger handle_new_user cria o profile como 'customer' sem
-- tenant_id, mas a regra tenant_required_unless_platform_admin só permitia
-- franquia vazia para platform_admin → o insert falhava e o Supabase
-- cancelava a criação da conta inteira.
--
-- Regra nova: só tenant_admin é obrigado a ter franquia. Um customer sem
-- franquia não enxerga nada (o RLS filtra por current_tenant_id()), e o
-- platform_admin continua sem franquia.

alter table public.profiles drop constraint if exists tenant_required_unless_platform_admin;
alter table public.profiles drop constraint if exists tenant_admin_requires_tenant;
alter table public.profiles add constraint tenant_admin_requires_tenant
  check (role <> 'tenant_admin' or tenant_id is not null);
