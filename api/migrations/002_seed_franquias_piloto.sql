-- ScanMercado — dados iniciais
-- As 4 franquias de exemplo e o catálogo da franquia piloto (os mesmos
-- produtos do catálogo local do app), com PLU nos itens de balança.
-- Usuários NÃO são criados aqui: o admin principal vem das variáveis
-- ADMIN_EMAIL / ADMIN_PASSWORD no primeiro boot (src/bootstrap.ts).

insert into tenants (id, slug, name, plan, status, accent_color, exclusivity_region, is_internal) values
  ('00000000-0000-0000-0000-000000000001', 'piloto', 'ScanMercado', 'padrao', 'ativa', '#1DB954', null, true),
  ('00000000-0000-0000-0000-000000000002', 'super-rede-sul', 'Super Rede Sul', 'pro', 'ativa', '#2563EB', 'Porto Alegre e região metropolitana', false),
  ('00000000-0000-0000-0000-000000000003', 'boa-vista', 'Mercado Boa Vista', 'pro', 'em_configuracao', '#EA580C', 'Salvador, raio de 25km', false),
  ('00000000-0000-0000-0000-000000000004', 'hiper-center', 'Hiper Center', 'enterprise', 'ativa', '#7C3AED', 'Zona Sul de São Paulo', false)
on conflict (id) do nothing;

insert into stores (tenant_id, name, cnpj, address) values
  ('00000000-0000-0000-0000-000000000001', 'ScanMercado - Loja Centro', '00.000.000/0001-00', 'Rua das Flores, 123 — Centro, Belo Horizonte')
on conflict do nothing;

insert into products (tenant_id, barcode, plu, name, price, unit, category) values
  ('00000000-0000-0000-0000-000000000001', '7891000100103', null,   'Arroz Branco 5kg', 24.90, 'un', 'Mercearia'),
  ('00000000-0000-0000-0000-000000000001', '7891000100202', null,   'Feijão Carioca 1kg', 8.49, 'un', 'Mercearia'),
  ('00000000-0000-0000-0000-000000000001', '7891000100301', null,   'Óleo de Soja 900ml', 7.99, 'un', 'Mercearia'),
  ('00000000-0000-0000-0000-000000000001', '7891000200104', null,   'Leite Integral 1L', 5.49, 'un', 'Laticínios'),
  ('00000000-0000-0000-0000-000000000001', '7891000200203', null,   'Queijo Mussarela 500g', 22.90, 'un', 'Laticínios'),
  ('00000000-0000-0000-0000-000000000001', '7891000300105', null,   'Refrigerante Cola 2L', 9.99, 'un', 'Bebidas'),
  ('00000000-0000-0000-0000-000000000001', '7891000300204', null,   'Água Mineral 1,5L', 3.50, 'un', 'Bebidas'),
  ('00000000-0000-0000-0000-000000000001', '7891000400106', null,   'Café Torrado 500g', 14.50, 'un', 'Mercearia'),
  ('00000000-0000-0000-0000-000000000001', '7891000400205', null,   'Pão de Forma Integral', 8.90, 'un', 'Padaria'),
  ('00000000-0000-0000-0000-000000000001', '7891000500107', null,   'Sabão em Pó 1,6kg', 19.90, 'un', 'Limpeza'),
  ('00000000-0000-0000-0000-000000000001', '7891000500206', null,   'Detergente 500ml', 2.79, 'un', 'Limpeza'),
  ('00000000-0000-0000-0000-000000000001', '7891000600108', null,   'Papel Higiênico 12 rolos', 23.90, 'un', 'Higiene'),
  ('00000000-0000-0000-0000-000000000001', '7891000600207', null,   'Shampoo 350ml', 16.90, 'un', 'Higiene'),
  ('00000000-0000-0000-0000-000000000001', '7891000700109', '1001', 'Maçã Gala (kg)', 7.99, 'kg', 'Hortifruti'),
  ('00000000-0000-0000-0000-000000000001', '7891000700208', '1002', 'Banana Prata (kg)', 5.49, 'kg', 'Hortifruti')
on conflict do nothing;

-- Promoções da loja
insert into promotions (tenant_id, product_id, kind, label, percent, buy_qty, pay_qty, fixed_price)
select p.tenant_id, p.id, v.kind, v.label, v.percent, v.buy_qty, v.pay_qty, v.fixed_price
from (values
  ('7891000100202', 'percent_off', '15% OFF',        15::numeric, null::integer, null::integer, null::numeric),
  ('7891000500107', 'percent_off', '20% OFF',        20,          null,          null,          null),
  ('7891000700208', 'percent_off', '10% OFF',        10,          null,          null,          null),
  ('7891000200104', 'buy_x_pay_y', 'Leve 3 Pague 2', null,        3,             2,             null),
  ('7891000300105', 'fixed_price', 'Preço especial', null,        null,          null,          6.99)
) as v(barcode, kind, label, percent, buy_qty, pay_qty, fixed_price)
join products p on p.tenant_id = '00000000-0000-0000-0000-000000000001' and p.barcode = v.barcode
where not exists (select 1 from promotions pr where pr.product_id = p.id);

-- Ofertas exclusivas de cliente
insert into member_promotions (tenant_id, product_id, label, extra_percent_off)
select p.tenant_id, p.id, v.label, v.extra
from (values
  ('7891000100103', 'Cliente ScanMercado: -10% no Arroz Branco 5kg', 10::numeric),
  ('7891000600108', 'Cliente ScanMercado: -15% no Papel Higiênico', 15),
  ('7891000700109', 'Cliente ScanMercado: -20% na Maçã Gala', 20),
  ('7891000400106', 'Cliente ScanMercado: -12% no Café Torrado', 12)
) as v(barcode, label, extra)
join products p on p.tenant_id = '00000000-0000-0000-0000-000000000001' and p.barcode = v.barcode
where not exists (select 1 from member_promotions mp where mp.product_id = p.id);
