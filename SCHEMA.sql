-- ScanMercado — schema de referência (PostgreSQL)
--
-- Este schema representa os dados que o app espera de um backend real.
-- Hoje o app usa dados mock em src/data/*.ts; os pontos de integração
-- estão documentados no README.md ("Banco de dados"). Rode este arquivo
-- inteiro num Postgres vazio (ex.: projeto novo no Supabase, aba SQL Editor)
-- para já testar com dados de exemplo iguais aos do app.

-- ============================================================
-- Lojas (opcional pra pilot de uma loja só, mas já deixa pronto
-- pra rede com várias filiais)
-- ============================================================
create table stores (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  cnpj          text unique,
  address       text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- Clientes (login do app)
-- ============================================================
create table users (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  cpf            text not null unique,       -- somente dígitos, 11 chars
  password_hash  text not null,              -- NUNCA salvar senha em texto puro
  points         integer not null default 0, -- pontos de fidelidade
  created_at     timestamptz not null default now()
);

-- ============================================================
-- Produtos (o que o app busca ao bipar um código de barras)
-- ============================================================
create table products (
  barcode     text primary key,              -- EAN-13/EAN-8/UPC lido pela câmera
  store_id    uuid references stores(id),
  name        text not null,
  price       numeric(10,2) not null,
  unit        text not null check (unit in ('un', 'kg')),
  category    text not null,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- Promoções da loja (valem pra qualquer cliente, aplicadas
-- automaticamente ao bipar — equivalente a Product.promotion no app)
-- ============================================================
create table promotions (
  id              uuid primary key default gen_random_uuid(),
  product_barcode text not null references products(barcode) on delete cascade,
  kind            text not null check (kind in ('percent_off', 'buy_x_pay_y', 'fixed_price')),
  label           text not null,             -- texto mostrado no app, ex: "Leve 3 Pague 2"
  percent         numeric(5,2),              -- usado quando kind = 'percent_off'
  buy_qty         integer,                   -- usado quando kind = 'buy_x_pay_y'
  pay_qty         integer,                   -- usado quando kind = 'buy_x_pay_y'
  fixed_price     numeric(10,2),             -- usado quando kind = 'fixed_price'
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,               -- null = sem data de fim definida
  active          boolean not null default true
);

-- ============================================================
-- Ofertas exclusivas de cliente logado (precisam ser ativadas
-- na aba Promoções antes de bipar — equivalente a MemberPromotion)
-- ============================================================
create table member_promotions (
  id                uuid primary key default gen_random_uuid(),
  product_barcode   text not null references products(barcode) on delete cascade,
  label             text not null,
  extra_percent_off numeric(5,2) not null,
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz,
  active            boolean not null default true
);

-- Quais ofertas de cliente cada usuário já ativou (toggle da aba Promoções)
create table user_activated_promotions (
  user_id             uuid not null references users(id) on delete cascade,
  member_promotion_id uuid not null references member_promotions(id) on delete cascade,
  activated_at        timestamptz not null default now(),
  primary key (user_id, member_promotion_id)
);

-- ============================================================
-- Sessões de carrinho (uma "passagem pelo mercado" bipando produtos)
-- Hoje o app guarda isso só localmente (AsyncStorage); estas tabelas
-- são o ponto de chegada quando o carrinho passar a sincronizar com
-- o backend (ex.: pra cruzar com o caixa, ou histórico de compras).
-- ============================================================
create table cart_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id),      -- null = cliente não logado (convidado)
  store_id    uuid references stores(id),
  status      text not null default 'open' check (status in ('open', 'checked_out', 'abandoned')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create table cart_items (
  id                 uuid primary key default gen_random_uuid(),
  cart_session_id    uuid not null references cart_sessions(id) on delete cascade,
  product_barcode    text not null references products(barcode),
  quantity            integer not null check (quantity > 0),
  unit_price_snapshot numeric(10,2) not null, -- preço no momento da bipagem (histórico não muda se o preço mudar depois)
  scanned_at          timestamptz not null default now()
);

-- ============================================================
-- Dados de teste (iguais aos mocks em src/data/*.ts, pra comparar
-- o comportamento do app rodando com mock vs. rodando com API real)
-- ============================================================

insert into stores (id, name, cnpj) values
  ('11111111-1111-1111-1111-111111111111', 'ScanMercado - Loja Centro', '00.000.000/0001-00');

insert into products (barcode, store_id, name, price, unit, category) values
  ('7891000100103', '11111111-1111-1111-1111-111111111111', 'Arroz Branco 5kg', 24.90, 'un', 'Mercearia'),
  ('7891000100202', '11111111-1111-1111-1111-111111111111', 'Feijão Carioca 1kg', 8.49, 'un', 'Mercearia'),
  ('7891000100301', '11111111-1111-1111-1111-111111111111', 'Óleo de Soja 900ml', 7.99, 'un', 'Mercearia'),
  ('7891000200104', '11111111-1111-1111-1111-111111111111', 'Leite Integral 1L', 5.49, 'un', 'Laticínios'),
  ('7891000200203', '11111111-1111-1111-1111-111111111111', 'Queijo Mussarela 500g', 22.90, 'un', 'Laticínios'),
  ('7891000300105', '11111111-1111-1111-1111-111111111111', 'Refrigerante Cola 2L', 9.99, 'un', 'Bebidas'),
  ('7891000300204', '11111111-1111-1111-1111-111111111111', 'Água Mineral 1,5L', 3.50, 'un', 'Bebidas'),
  ('7891000400106', '11111111-1111-1111-1111-111111111111', 'Café Torrado 500g', 14.50, 'un', 'Mercearia'),
  ('7891000400205', '11111111-1111-1111-1111-111111111111', 'Pão de Forma Integral', 8.90, 'un', 'Padaria'),
  ('7891000500107', '11111111-1111-1111-1111-111111111111', 'Sabão em Pó 1,6kg', 19.90, 'un', 'Limpeza'),
  ('7891000500206', '11111111-1111-1111-1111-111111111111', 'Detergente 500ml', 2.79, 'un', 'Limpeza'),
  ('7891000600108', '11111111-1111-1111-1111-111111111111', 'Papel Higiênico 12 rolos', 23.90, 'un', 'Higiene'),
  ('7891000600207', '11111111-1111-1111-1111-111111111111', 'Shampoo 350ml', 16.90, 'un', 'Higiene'),
  ('7891000700109', '11111111-1111-1111-1111-111111111111', 'Maçã Gala (kg)', 7.99, 'kg', 'Hortifruti'),
  ('7891000700208', '11111111-1111-1111-1111-111111111111', 'Banana Prata (kg)', 5.49, 'kg', 'Hortifruti');

insert into promotions (product_barcode, kind, label, percent) values
  ('7891000100202', 'percent_off', '15% OFF', 15),
  ('7891000500107', 'percent_off', '20% OFF', 20),
  ('7891000700208', 'percent_off', '10% OFF', 10);

insert into promotions (product_barcode, kind, label, buy_qty, pay_qty) values
  ('7891000200104', 'buy_x_pay_y', 'Leve 3 Pague 2', 3, 2);

insert into promotions (product_barcode, kind, label, fixed_price) values
  ('7891000300105', 'fixed_price', 'Preço especial', 6.99);

insert into member_promotions (product_barcode, label, extra_percent_off) values
  ('7891000100103', 'Cliente ScanMercado: -10% no Arroz Branco 5kg', 10),
  ('7891000600108', 'Cliente ScanMercado: -15% no Papel Higiênico', 15),
  ('7891000700109', 'Cliente ScanMercado: -20% na Maçã Gala', 20),
  ('7891000400106', 'Cliente ScanMercado: -12% no Café Torrado', 12);

-- Senha de teste "123456" (troque por bcrypt/argon2 de verdade no backend!)
insert into users (name, cpf, password_hash, points) values
  ('João Victor', '12345678900', '123456', 480),
  ('Maria Souza', '98765432100', '123456', 1250);

-- ============================================================
-- Row Level Security — o app (chave "anon") só precisa LER
-- produtos e promoções pra funcionar o scanner. As outras
-- tabelas ficam com RLS ativo e sem política pública = ninguém
-- lê/escreve direto do app (login, carrinho, etc. continuam
-- mock no app até existir uma API própria por trás de auth real).
-- ============================================================
alter table products enable row level security;
alter table promotions enable row level security;
alter table member_promotions enable row level security;
alter table stores enable row level security;
alter table users enable row level security;
alter table user_activated_promotions enable row level security;
alter table cart_sessions enable row level security;
alter table cart_items enable row level security;

create policy "Qualquer um pode ler produtos ativos"
  on products for select
  using (active = true);

create policy "Qualquer um pode ler promoções ativas"
  on promotions for select
  using (active = true);

create policy "Qualquer um pode ler ofertas de cliente ativas"
  on member_promotions for select
  using (active = true);

create policy "Qualquer um pode ler lojas"
  on stores for select
  using (true);
