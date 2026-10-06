-- ScanMercado — schema multi-tenant (PostgreSQL / Supabase)
--
-- Isso substitui o schema de loja única anterior. A partir de agora o banco
-- é compartilhado por VÁRIAS franquias (tenants) com exclusividade
-- territorial — cada franquia só enxerga e edita os próprios dados,
-- reforçado por Row Level Security (RLS), não só por filtro no app.
--
-- Rode este arquivo inteiro num Postgres vazio (Supabase > SQL Editor).
-- Em seguida rode supabase/aplicar_tudo.sql (todas as migrações juntas;
-- pode rodar de novo sem problema) e crie o admin principal com
-- supabase/seed_usuarios_admin.sql.

-- ============================================================
-- TENANTS — cada franquia/rede de supermercado cliente
-- ============================================================
create table public.tenants (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,            -- vira o subdomínio/identificador do app: {slug}.scanmercado.app
  name               text not null,                    -- nome fantasia, ex. "Super Rede Sul"
  plan               text not null default 'padrao' check (plan in ('padrao', 'pro', 'enterprise')),
  status             text not null default 'em_configuracao' check (status in ('ativa', 'em_configuracao', 'suspensa')),
  accent_color       text not null default '#1DB954',  -- cor principal do app dessa franquia (hex)
  logo_url           text,
  exclusivity_region text,                             -- registro em texto livre do território — controle comercial, não geofencing
  is_internal        boolean not null default false,   -- true só pro projeto piloto interno (não é cliente pagante)
  created_at         timestamptz not null default now()
);

comment on column public.tenants.exclusivity_region is
  'Descrição livre do território com exclusividade contratual (ex.: "Porto Alegre e região metropolitana"). Controle comercial manual — sem verificação automática de conflito por enquanto.';

-- ============================================================
-- PROFILES — estende auth.users (login de verdade via Supabase Auth,
-- nunca mais senha em texto puro numa tabela própria)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid references public.tenants(id),       -- null só pra platform_admin (você)
  role        text not null default 'customer' check (role in ('platform_admin', 'tenant_admin', 'customer')),
  name        text not null default '',
  cpf         text unique,                               -- cliente final loga com CPF (ver nota de auth no README)
  points      integer not null default 0,
  created_at  timestamptz not null default now(),
  -- Só admin de franquia é obrigado a ter franquia (ver migração 003: a regra
  -- antiga barrava a criação de qualquer conta sem franquia).
  constraint tenant_admin_requires_tenant
    check (role <> 'tenant_admin' or tenant_id is not null)
);

-- Cria o profile automaticamente quando alguém se cadastra via Supabase Auth.
-- raw_user_meta_data vem do signUp({ options: { data: {...} } }) no app.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, tenant_id, name, cpf)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'customer'),
    nullif(new.raw_user_meta_data ->> 'tenant_id', '')::uuid,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'cpf'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Funções auxiliares de RLS — SECURITY DEFINER + search_path fixo
-- (sem isso, funções SECURITY DEFINER são vulneráveis a search_path
-- hijacking; e sem SECURITY DEFINER, políticas que leem "profiles"
-- dentro de uma política de "profiles" entram em recursão infinita)
-- ============================================================
create or replace function public.current_tenant_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'platform_admin' from public.profiles where id = auth.uid()), false)
$$;

-- O app mobile não loga (cliente anônimo bipando produto) precisa saber
-- de qual franquia ele é SEM depender de auth.uid(). Cada build/config do
-- app manda o tenant_id dele no header "x-tenant-id" (ver supabase.ts).
-- Isso filtra pelo banco mesmo sem login — defesa em profundidade: mesmo
-- que o app esqueça um .eq('tenant_id', ...) em algum lugar, o RLS ainda
-- não deixa vazar catálogo de uma franquia pra outra.
create or replace function public.request_tenant_id()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-tenant-id', '')::uuid
$$;

-- ============================================================
-- STORES — lojas físicas de cada franquia
-- ============================================================
create table public.stores (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  cnpj        text,
  address     text,
  hours       text,
  lat         numeric(9,6),
  lng         numeric(9,6),
  created_at  timestamptz not null default now(),
  unique (tenant_id, cnpj)
);

-- ============================================================
-- PRODUCTS — catálogo por franquia. Chave primária é um id próprio
-- (não o código de barras): o mesmo EAN pode existir em franquias
-- diferentes com nome/preço diferentes, e um id substituível evita
-- quebrar tudo se o cliente mandar o mesmo produto duas vezes na
-- importação.
-- ============================================================
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  barcode         text not null,                 -- EAN-13/EAN-8/UPC lido pela câmera
  external_code   text,                           -- código interno do PDV do cliente, se houver (rastreabilidade na importação)
  name            text not null,
  price           numeric(10,2) not null check (price >= 0),
  unit            text not null check (unit in ('un', 'kg')),
  category        text not null,
  active          boolean not null default true,
  updated_at      timestamptz not null default now(),
  unique (tenant_id, barcode)
);

create index products_tenant_category_idx on public.products (tenant_id, category) where active;
create index products_tenant_barcode_idx on public.products (tenant_id, barcode);

-- ============================================================
-- PROMOTIONS — promoções da loja, valem pra qualquer cliente
-- (tenant_id vem duplicado aqui de propósito: RLS mais simples e
-- rápida não precisa fazer join com products pra checar o dono)
-- ============================================================
create table public.promotions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  kind        text not null check (kind in ('percent_off', 'buy_x_pay_y', 'fixed_price')),
  label       text not null,
  percent     numeric(5,2),
  buy_qty     integer,
  pay_qty     integer,
  fixed_price numeric(10,2),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  active      boolean not null default true
);

create index promotions_tenant_active_idx on public.promotions (tenant_id) where active;

-- ============================================================
-- MEMBER_PROMOTIONS — ofertas exclusivas de cliente logado
-- ============================================================
create table public.member_promotions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete cascade,
  label             text not null,
  extra_percent_off numeric(5,2) not null,
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz,
  active            boolean not null default true
);

create table public.member_promotion_activations (
  profile_id           uuid not null references public.profiles(id) on delete cascade,
  member_promotion_id  uuid not null references public.member_promotions(id) on delete cascade,
  activated_at         timestamptz not null default now(),
  primary key (profile_id, member_promotion_id)
);

-- ============================================================
-- FAVORITES — hoje só no AsyncStorage do celular; aqui é o destino
-- quando passar a sincronizar entre aparelhos
-- ============================================================
create table public.favorites (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, product_id)
);

-- ============================================================
-- Carrinho / histórico de compras
-- ============================================================
create table public.cart_sessions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  profile_id  uuid references public.profiles(id),        -- null = cliente convidado (sem login)
  store_id    uuid references public.stores(id),
  status      text not null default 'open' check (status in ('open', 'checked_out', 'abandoned')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create table public.cart_items (
  id                   uuid primary key default gen_random_uuid(),
  cart_session_id      uuid not null references public.cart_sessions(id) on delete cascade,
  product_id           uuid not null references public.products(id),
  quantity             integer not null check (quantity > 0),
  unit_price_snapshot  numeric(10,2) not null,  -- preço no momento da bipagem — histórico não muda se o preço mudar depois
  scanned_at           timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS — central de notificações (hoje local no app);
-- profile_id null = broadcast pra todos os clientes daquele tenant
-- ============================================================
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('coupon', 'budget', 'system')),
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

-- ============================================================
-- CATALOG_IMPORTS — auditoria de importação de catálogo do cliente
-- (o objetivo declarado é importar os produtos já cadastrados de
-- cada franquia; isso registra quem importou o quê e quando,
-- em vez de só fazer um INSERT solto sem rastro)
-- ============================================================
create table public.catalog_imports (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  imported_by    uuid references public.profiles(id),
  source_name    text,                         -- ex.: nome do arquivo CSV recebido do cliente
  row_count      integer not null default 0,
  error_count    integer not null default 0,
  status         text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at     timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Padrão em quase toda tabela: platform_admin vê tudo; tenant_admin
-- vê/edita só o próprio tenant; customer vê só os próprios dados
-- dentro do próprio tenant; leitura pública (sem login) só no
-- catálogo, e mesmo assim restrita ao tenant do header da requisição.
-- ============================================================

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.promotions enable row level security;
alter table public.member_promotions enable row level security;
alter table public.member_promotion_activations enable row level security;
alter table public.favorites enable row level security;
alter table public.cart_sessions enable row level security;
alter table public.cart_items enable row level security;
alter table public.notifications enable row level security;
alter table public.catalog_imports enable row level security;

-- TENANTS: só platform_admin lista/edita franquias; cada tenant_admin
-- consegue ler (não editar) a própria linha, pra mostrar nome/cor/slug.
create policy "platform admin full access to tenants"
  on public.tenants for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "tenant reads own row"
  on public.tenants for select
  using (id = public.current_tenant_id());

-- PROFILES
create policy "platform admin full access to profiles"
  on public.profiles for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "user reads own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "user updates own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and tenant_id = public.current_tenant_id());

-- "tenant admin reads profiles of own tenant" é criada na migração 002 com
-- is_tenant_admin(). A versão antiga consultava "profiles" dentro da própria
-- política e causava "infinite recursion detected in policy".

-- STORES (lista de lojas é pública pro app do cliente final consultar)
create policy "platform admin full access to stores"
  on public.stores for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "tenant staff manage own stores"
  on public.stores for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "public reads stores of current app tenant"
  on public.stores for select
  to anon, authenticated
  using (tenant_id = public.request_tenant_id());

-- PRODUCTS
create policy "platform admin full access to products"
  on public.products for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "tenant staff manage own products"
  on public.products for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "public reads active products of current app tenant"
  on public.products for select
  to anon, authenticated
  using (active = true and tenant_id = public.request_tenant_id());

-- PROMOTIONS (mesmo padrão de products)
create policy "platform admin full access to promotions"
  on public.promotions for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "tenant staff manage own promotions"
  on public.promotions for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "public reads active promotions of current app tenant"
  on public.promotions for select
  to anon, authenticated
  using (active = true and tenant_id = public.request_tenant_id());

-- MEMBER_PROMOTIONS: só clientes logados enxergam (precisa de auth.uid()),
-- nunca anônimo — é "exclusivo de cliente" de verdade, não só de nome.
create policy "platform admin full access to member_promotions"
  on public.member_promotions for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "tenant staff manage own member_promotions"
  on public.member_promotions for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "logged-in customers read active member_promotions of own tenant"
  on public.member_promotions for select
  to authenticated
  using (active = true and tenant_id = public.current_tenant_id());

-- MEMBER_PROMOTION_ACTIVATIONS
create policy "platform admin full access to activations"
  on public.member_promotion_activations for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "customer manages own activations"
  on public.member_promotion_activations for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "tenant admin reads activations of own tenant"
  on public.member_promotion_activations for select
  using (
    exists (
      select 1 from public.member_promotions mp
      where mp.id = member_promotion_id and mp.tenant_id = public.current_tenant_id()
    )
  );

-- FAVORITES
create policy "platform admin full access to favorites"
  on public.favorites for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "customer manages own favorites"
  on public.favorites for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and tenant_id = public.current_tenant_id());

-- CART_SESSIONS / CART_ITEMS
create policy "platform admin full access to cart_sessions"
  on public.cart_sessions for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "customer manages own cart_sessions"
  on public.cart_sessions for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and tenant_id = public.current_tenant_id());

-- "tenant admin reads cart_sessions of own tenant" é criada na migração 002
-- (mesmo motivo da política de profiles acima).

create policy "platform admin full access to cart_items"
  on public.cart_items for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "customer manages own cart_items"
  on public.cart_items for all
  using (exists (
    select 1 from public.cart_sessions cs
    where cs.id = cart_session_id and cs.profile_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.cart_sessions cs
    where cs.id = cart_session_id and cs.profile_id = auth.uid()
  ));

-- NOTIFICATIONS
create policy "platform admin full access to notifications"
  on public.notifications for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "tenant staff manage own notifications"
  on public.notifications for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "customer reads own or broadcast notifications"
  on public.notifications for select
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (profile_id = auth.uid() or profile_id is null)
  );

create policy "customer marks own notifications read"
  on public.notifications for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- CATALOG_IMPORTS
create policy "platform admin full access to catalog_imports"
  on public.catalog_imports for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "tenant staff manage own catalog_imports"
  on public.catalog_imports for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- ============================================================
-- SEED — as 4 franquias do preview do admin + catálogo de exemplo
-- só na piloto interna (as outras ainda não têm catálogo: é o que
-- vai vir da importação de cada cliente)
-- ============================================================
insert into public.tenants (id, slug, name, plan, status, accent_color, exclusivity_region, is_internal) values
  ('00000000-0000-0000-0000-000000000001', 'piloto', 'ScanMercado', 'padrao', 'ativa', '#1DB954', null, true),
  ('00000000-0000-0000-0000-000000000002', 'super-rede-sul', 'Super Rede Sul', 'pro', 'ativa', '#2563EB', 'Porto Alegre e região metropolitana', false),
  ('00000000-0000-0000-0000-000000000003', 'boa-vista', 'Mercado Boa Vista', 'pro', 'em_configuracao', '#EA580C', 'Salvador, raio de 25km', false),
  ('00000000-0000-0000-0000-000000000004', 'hiper-center', 'Hiper Center', 'enterprise', 'ativa', '#7C3AED', 'Zona Sul de São Paulo', false);

insert into public.stores (tenant_id, name, cnpj, address) values
  ('00000000-0000-0000-0000-000000000001', 'ScanMercado - Loja Centro', '00.000.000/0001-00', 'Rua das Flores, 123 — Centro, Belo Horizonte');

insert into public.products (tenant_id, barcode, name, price, unit, category) values
  ('00000000-0000-0000-0000-000000000001', '7891000100103', 'Arroz Branco 5kg', 24.90, 'un', 'Mercearia'),
  ('00000000-0000-0000-0000-000000000001', '7891000100202', 'Feijão Carioca 1kg', 8.49, 'un', 'Mercearia'),
  ('00000000-0000-0000-0000-000000000001', '7891000100301', 'Óleo de Soja 900ml', 7.99, 'un', 'Mercearia'),
  ('00000000-0000-0000-0000-000000000001', '7891000200104', 'Leite Integral 1L', 5.49, 'un', 'Laticínios'),
  ('00000000-0000-0000-0000-000000000001', '7891000200203', 'Queijo Mussarela 500g', 22.90, 'un', 'Laticínios'),
  ('00000000-0000-0000-0000-000000000001', '7891000300105', 'Refrigerante Cola 2L', 9.99, 'un', 'Bebidas'),
  ('00000000-0000-0000-0000-000000000001', '7891000300204', 'Água Mineral 1,5L', 3.50, 'un', 'Bebidas'),
  ('00000000-0000-0000-0000-000000000001', '7891000400106', 'Café Torrado 500g', 14.50, 'un', 'Mercearia'),
  ('00000000-0000-0000-0000-000000000001', '7891000400205', 'Pão de Forma Integral', 8.90, 'un', 'Padaria'),
  ('00000000-0000-0000-0000-000000000001', '7891000500107', 'Sabão em Pó 1,6kg', 19.90, 'un', 'Limpeza'),
  ('00000000-0000-0000-0000-000000000001', '7891000500206', 'Detergente 500ml', 2.79, 'un', 'Limpeza'),
  ('00000000-0000-0000-0000-000000000001', '7891000600108', 'Papel Higiênico 12 rolos', 23.90, 'un', 'Higiene'),
  ('00000000-0000-0000-0000-000000000001', '7891000600207', 'Shampoo 350ml', 16.90, 'un', 'Higiene'),
  ('00000000-0000-0000-0000-000000000001', '7891000700109', 'Maçã Gala (kg)', 7.99, 'kg', 'Hortifruti'),
  ('00000000-0000-0000-0000-000000000001', '7891000700208', 'Banana Prata (kg)', 5.49, 'kg', 'Hortifruti');

insert into public.promotions (tenant_id, product_id, kind, label, percent)
  select '00000000-0000-0000-0000-000000000001', id, 'percent_off', '15% OFF', 15
  from public.products where tenant_id = '00000000-0000-0000-0000-000000000001' and barcode = '7891000100202';

insert into public.promotions (tenant_id, product_id, kind, label, percent)
  select '00000000-0000-0000-0000-000000000001', id, 'percent_off', '20% OFF', 20
  from public.products where tenant_id = '00000000-0000-0000-0000-000000000001' and barcode = '7891000500107';

insert into public.promotions (tenant_id, product_id, kind, label, percent)
  select '00000000-0000-0000-0000-000000000001', id, 'percent_off', '10% OFF', 10
  from public.products where tenant_id = '00000000-0000-0000-0000-000000000001' and barcode = '7891000700208';

insert into public.promotions (tenant_id, product_id, kind, label, buy_qty, pay_qty)
  select '00000000-0000-0000-0000-000000000001', id, 'buy_x_pay_y', 'Leve 3 Pague 2', 3, 2
  from public.products where tenant_id = '00000000-0000-0000-0000-000000000001' and barcode = '7891000200104';

insert into public.promotions (tenant_id, product_id, kind, label, fixed_price)
  select '00000000-0000-0000-0000-000000000001', id, 'fixed_price', 'Preço especial', 6.99
  from public.products where tenant_id = '00000000-0000-0000-0000-000000000001' and barcode = '7891000300105';

insert into public.member_promotions (tenant_id, product_id, label, extra_percent_off)
  select '00000000-0000-0000-0000-000000000001', id, 'Cliente ScanMercado: -10% no Arroz Branco 5kg', 10
  from public.products where tenant_id = '00000000-0000-0000-0000-000000000001' and barcode = '7891000100103';

insert into public.member_promotions (tenant_id, product_id, label, extra_percent_off)
  select '00000000-0000-0000-0000-000000000001', id, 'Cliente ScanMercado: -15% no Papel Higiênico', 15
  from public.products where tenant_id = '00000000-0000-0000-0000-000000000001' and barcode = '7891000600108';

insert into public.member_promotions (tenant_id, product_id, label, extra_percent_off)
  select '00000000-0000-0000-0000-000000000001', id, 'Cliente ScanMercado: -20% na Maçã Gala', 20
  from public.products where tenant_id = '00000000-0000-0000-0000-000000000001' and barcode = '7891000700109';

insert into public.member_promotions (tenant_id, product_id, label, extra_percent_off)
  select '00000000-0000-0000-0000-000000000001', id, 'Cliente ScanMercado: -12% no Café Torrado', 12
  from public.products where tenant_id = '00000000-0000-0000-0000-000000000001' and barcode = '7891000400106';

-- ============================================================
-- BOOTSTRAP (rode manualmente, uma vez, depois do resto):
--
-- 1. Crie sua conta normalmente pelo app ou por
--    Authentication > Users > Add user no painel do Supabase.
-- 2. Copie o UUID dessa conta e rode:
--
--    update public.profiles
--    set role = 'platform_admin', tenant_id = null
--    where id = 'COLE-O-UUID-AQUI';
--
-- Sem isso, ninguém consegue gerenciar franquias: toda conta nasce
-- como 'customer' (ver handle_new_user acima).
--
-- 3. (Opcional) Para dar acesso ao painel admin ao dono de UMA franquia,
--    crie a conta dele do mesmo jeito e rode:
--
--    update public.profiles
--    set role = 'tenant_admin', tenant_id = 'UUID-DA-FRANQUIA'
--    where id = 'UUID-DA-CONTA';
-- ============================================================
