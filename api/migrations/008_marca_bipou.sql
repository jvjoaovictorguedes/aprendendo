-- Bipou — a plataforma deixa de se chamar ScanMercado.
--
-- Renomeia os dados iniciais que ainda carregam o nome antigo. Só troca o
-- que continua exatamente como veio do seed: se alguém já renomeou a
-- franquia, a loja ou uma oferta pelo painel, nada disso é sobrescrito.

update tenants
  set name = 'Bipou'
  where id = '00000000-0000-0000-0000-000000000001' and name = 'ScanMercado';

update stores
  set name = replace(name, 'ScanMercado', 'Bipou')
  where tenant_id = '00000000-0000-0000-0000-000000000001' and name like 'ScanMercado%';

update promotions
  set label = replace(label, 'Cliente ScanMercado:', 'Cliente Bipou:')
  where tenant_id = '00000000-0000-0000-0000-000000000001' and label like 'Cliente ScanMercado:%';

update member_promotions
  set label = replace(label, 'Cliente ScanMercado:', 'Cliente Bipou:')
  where tenant_id = '00000000-0000-0000-0000-000000000001' and label like 'Cliente ScanMercado:%';

-- Nome padrão do admin principal criado pelo boot.
update users
  set name = 'Equipe Bipou'
  where role = 'platform_admin' and name = 'Equipe ScanMercado';
