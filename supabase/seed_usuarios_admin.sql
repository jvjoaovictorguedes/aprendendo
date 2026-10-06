-- ScanMercado — cria (ou atualiza) contas de acesso ao painel admin.
--
-- COMO USAR
--   1. Rode antes as migrações 001 e 002 (supabase/migrations/).
--   2. Copie este arquivo para o SQL Editor do Supabase.
--   3. Troque os e-mails/senhas no bloco "CONTAS" lá no editor.
--      NÃO salve senhas reais neste arquivo nem faça commit delas.
--   4. Rode. Pode rodar de novo quando quiser: e-mail que já existe tem
--      a senha, o nome e o papel atualizados (nada é duplicado).
--
-- PAPÉIS
--   platform_admin  equipe ScanMercado — todas as franquias, usuários e
--                   configurações. tenant_id = null.
--   tenant_admin    dono/gerente de UMA franquia — produtos, balança,
--                   regras e marca só da franquia dele. tenant_id obrigatório.
--   customer        cliente do app — não acessa o painel.
--
-- Depois do painel no ar, prefira criar lojistas pela tela
-- Plataforma → Usuários (gera senha temporária no servidor). Este script
-- serve para o primeiro acesso e para contas de teste.

create or replace function pg_temp.upsert_admin(
  p_email     text,
  p_password  text,
  p_name      text,
  p_role      text,
  p_tenant_id uuid
) returns text
language plpgsql
as $$
declare
  v_email   text := lower(trim(p_email));
  v_user_id uuid;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or v_email like '%troque%' then
    raise exception 'Troque o e-mail de exemplo (%) antes de rodar.', p_email;
  end if;
  if length(p_password) < 8 or p_password ilike '%troque%' then
    raise exception 'Defina uma senha de verdade (mínimo 8 caracteres) para %.', v_email;
  end if;
  if p_role not in ('platform_admin', 'tenant_admin', 'customer') then
    raise exception 'Papel inválido: %', p_role;
  end if;
  if p_role <> 'platform_admin' and p_tenant_id is null then
    raise exception '% precisa de uma franquia (tenant_id).', v_email;
  end if;
  if p_role = 'platform_admin' then
    p_tenant_id := null;
  end if;

  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                         'role', p_role, 'tenant_id', p_tenant_id),
      jsonb_build_object('name', p_name),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id, v_user_id::text, 'email',
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );
  else
    update auth.users
      set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          raw_app_meta_data  = coalesce(raw_app_meta_data, '{}'::jsonb)
                               || jsonb_build_object('role', p_role, 'tenant_id', p_tenant_id),
          raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                               || jsonb_build_object('name', p_name),
          banned_until       = null,
          updated_at         = now()
      where id = v_user_id;
  end if;

  -- O trigger handle_new_user já criou o profile; garante papel/franquia/nome.
  insert into public.profiles (id, role, tenant_id, name, email)
    values (v_user_id, p_role, p_tenant_id, p_name, v_email)
  on conflict (id) do update
    set role = excluded.role,
        tenant_id = excluded.tenant_id,
        name = excluded.name,
        email = excluded.email,
        disabled_at = null;

  return format('%s → %s%s', v_email, p_role,
                coalesce(' (' || (select name from public.tenants where id = p_tenant_id) || ')', ''));
end;
$$;

-- ============================================================
-- CONTAS — troque e-mails, nomes e senhas aqui (no SQL Editor)
-- Franquias do seed: 00000000-0000-0000-0000-000000000001 ScanMercado (piloto)
--                    00000000-0000-0000-0000-000000000002 Super Rede Sul
--                    00000000-0000-0000-0000-000000000003 Mercado Boa Vista
--                    00000000-0000-0000-0000-000000000004 Hiper Center
-- ============================================================
select pg_temp.upsert_admin(
  'troque-seu-email@empresa.com.br', 'troque-esta-senha', 'Equipe ScanMercado',
  'platform_admin', null
)
union all
select pg_temp.upsert_admin(
  'troque-lojista@mercado.com.br', 'troque-esta-senha', 'Lojista Piloto',
  'tenant_admin', '00000000-0000-0000-0000-000000000001'
);
