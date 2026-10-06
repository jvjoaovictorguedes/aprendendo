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
