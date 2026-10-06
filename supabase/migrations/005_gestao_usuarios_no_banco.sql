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
