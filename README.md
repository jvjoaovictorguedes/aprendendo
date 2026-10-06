# ScanMercado (app piloto)

App mobile (Expo / React Native) para clientes de supermercado. O cliente **bipa o código de barras** de cada produto com a câmera do celular enquanto faz as compras, e o app vai somando os valores — incluindo promoções — para mostrar uma **prévia do total a pagar** antes de chegar ao caixa.

> Este app **não substitui o caixa**: é uma conferência para o cliente. O valor final é sempre o do PDV do supermercado.

## O que já funciona

**Scan & Go (núcleo do app):**
- Leitura de código de barras (EAN-13, EAN-8, UPC-A, UPC-E, Code128) pela câmera, usando `expo-camera`, com feedback imediato (nome, preço, **desfazer**) e háptico a cada bipagem.
- Busca de produto **real no Supabase** quando configurado (ver seção abaixo), com fallback automático pro catálogo local se o Supabase não estiver configurado ou a chamada falhar — o scanner nunca trava esperando resposta.
- Cada bipagem soma automaticamente ao carrinho (produto repetido = quantidade +1).
- **Etiqueta de balança** (hortifrúti, açougue, frios): o cliente pesa o produto, a balança imprime um EAN-13 de peso variável com o PLU e o preço (ou peso) embutidos, e o app lê o valor direto do código. Cada produto é cadastrado **uma vez só** (PLU + preço do kg) — qualquer peso funciona. O formato da etiqueta é configurável por franquia (ver "Painel admin").
- Câmera pausa automaticamente quando a aba não está em foco (bateria/privacidade).
- Tela **Carrinho** com lista dos itens, favoritar, ajuste manual de quantidade, remoção e total com hierarquia visual forte.
- Motor de promoções: `% OFF`, `leve X pague Y` e `preço fixo promocional` (gerais da loja), mais **ofertas exclusivas de cliente logado** que se ativam na aba Promoções e empilham sobre a promoção geral.
- **Finalizar compra** de verdade: arquiva a compra no histórico e limpa o carrinho (não é só um alerta).

**Em torno do Scan & Go:**
- **Home**: saudação, CTA "Começar/Continuar comprando", resumo do carrinho atual, ofertas, listas e compras recentes.
- **Login do cliente** (CPF + senha) — aba Perfil, com pontos de fidelidade.
- **Listas de compras**: criar, adicionar/remover itens, marcar como comprado; ao bipar na aba Comprar, item que bate com a lista ativa é marcado automaticamente ("✓ Item da sua lista").
- **Histórico de compras**: data, itens, total, economia e **"Comprar novamente"** (adiciona os mesmos itens ao carrinho atual, com preço de hoje).
- **Favoritos** (coração no item do carrinho).
- **Orçamento**: definir um limite na aba Perfil; durante o Scan&Go mostra quanto resta, sem ser alarmista.
- Tudo persistido localmente (`AsyncStorage`) — fechar o app não perde nada.
- Design system centralizado em `src/theme/tokens.ts` + componentes base em `src/components/ui/`.

## Conectando ao Supabase (catálogo real pro scanner)

O banco agora é **multi-tenant**: um projeto Supabase só, compartilhado por várias franquias (ver "Banco de dados" abaixo). Cada build do app representa UMA franquia, identificada por `EXPO_PUBLIC_TENANT_ID`.

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o arquivo [`SCHEMA.sql`](./SCHEMA.sql) inteiro (cria tenants, profiles, products, promotions etc., ativa RLS em tudo, e popula a franquia piloto com os mesmos produtos do mock). Depois rode, em ordem, cada arquivo de [`supabase/migrations/`](./supabase/migrations) (uma vez só). No fim do `SCHEMA.sql` tem um passo manual (bootstrap do seu usuário platform_admin) — não pule.

   Banco que **já existia** antes do painel admin: rode só [`supabase/migrations/001_balanca_config_franquia_admin.sql`](./supabase/migrations/001_balanca_config_franquia_admin.sql). Ela adiciona o PLU, a tabela `tenant_settings` e corrige duas falhas de RLS (cliente logado conseguia editar catálogo da própria franquia e se promover a admin).
3. Em **Project Settings → API**, copie a `Project URL` e a chave `anon public`.
4. Copie `.env.example` para `.env` na raiz do projeto e preencha:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
   EXPO_PUBLIC_TENANT_ID=00000000-0000-0000-0000-000000000001
   ```
   O `TENANT_ID` acima já é o da franquia piloto que vem no seed do `SCHEMA.sql` — troque pelo `id` de outra linha em `tenants` pra rodar o app "como" outra franquia.
5. Reinicie o `npx expo start` (ou gere um novo build) — o scanner (`src/services/catalog.ts`) passa a consultar `products`/`promotions` no Supabase a cada bipagem, sempre filtrado pela franquia do `.env` (via header `x-tenant-id`, reforçado por RLS no banco). Se a tabela não tiver aquele código de barras pra essa franquia, aparece "Produto não cadastrado" (mesmo comportamento de antes).

Pra testar com dados seus: edite a tabela `products` direto no **Table Editor** do Supabase (adicionar/mudar preço/criar promoção), sempre preenchendo o `tenant_id` certo, e gere uma imagem de código de barras com o mesmo número em qualquer gerador de EAN-13 online.

Sem o `.env` configurado (as três variáveis), o app continua funcionando normalmente com o catálogo local mock — nada quebra.

**Importante pro build com EAS:** o `.env` local só vale pra rodar com `npx expo start`. Pra essas variáveis irem também no `.apk` gerado pelo `eas build`, configure-as como variáveis de ambiente do projeto na EAS (`eas env:create` ou pelo site expo.dev → seu projeto → Environment variables, marcando visibilidade "Plain text" para o perfil `preview`) — senão o app buildado cai no catálogo mock mesmo com o Supabase configurado localmente.

## O que é mock (pilot) e precisa de integração real

- **Catálogo de produtos/promoções gerais**: já pode vir do Supabase (ver acima). Sem Supabase configurado, usa `src/data/products.ts`.
- **Ofertas exclusivas de cliente**: `src/data/memberPromotions.ts` — ainda não migrado pro Supabase (próximo passo natural: mesma mecânica do catálogo, já tem tabela pronta no `SCHEMA.sql`).
- **Login/usuários**: `src/data/users.ts` + `src/context/AuthContext.tsx` (senha em texto puro só porque é mock — isso NUNCA pode ir pra produção assim). O `SCHEMA.sql` já modela o jeito certo (Supabase Auth + `profiles`, sem senha própria) — falta só trocar a função `login()` em `AuthContext.tsx` para chamar `supabase.auth.signInWithPassword(...)` em vez do mock.

## Banco de dados (multi-tenant, schema esperado)

O arquivo **[`SCHEMA.sql`](./SCHEMA.sql)** na raiz do projeto tem o schema completo em PostgreSQL, pensado pra vender a mesma base de código pra **várias franquias de supermercado com exclusividade territorial** (cada uma com sua própria marca, cores e catálogo, mas sem enxergar os dados umas das outras).

Três papéis (`profiles.role`): **`platform_admin`** (você — vê e edita todas as franquias), **`tenant_admin`** (o dono da franquia — só vê e edita a própria, via o painel de Marca & Cores), **`customer`** (cliente final do app, escopado à franquia dele). Login é sempre via **Supabase Auth** — nada de senha em texto puro numa tabela própria — e cada franquia é isolada por **Row Level Security**, não só por filtro no app: até as leituras sem login (scanner anônimo) são restritas pelo header `x-tenant-id` que o app manda em toda consulta (ver `src/services/supabase.ts`).

Tabelas principais:

| Tabela | Pra quê serve | Mapeia pra qual tipo no app |
|---|---|---|
| `tenants` | Cada franquia: nome, cor, logo, plano, status, território de exclusividade | tela "Franquias" do admin |
| `profiles` | Estende `auth.users` — role, franquia, pontos de fidelidade | `User` (`src/data/users.ts`) |
| `products` | Catálogo por franquia (chave própria + `unique(tenant_id, barcode)`, não o barcode como PK — duas franquias podem ter o mesmo EAN com nome/preço diferentes) | `Product` (`src/types.ts`) |
| `promotions` | Promoções gerais da loja (% off, leve/pague, preço fixo), por franquia | `Product.promotion` |
| `member_promotions` / `member_promotion_activations` | Ofertas exclusivas de cliente logado e quem ativou o quê | `MemberPromotion` + estado do `PromotionsContext` |
| `favorites` | Produtos favoritados, por cliente | `FavoritesContext` |
| `cart_sessions` / `cart_items` | Histórico de "passagens pelo mercado" — hoje o carrinho só vive no celular (`AsyncStorage`); destino quando sincronizar com o backend | `CartItem[]` do `CartContext` |
| `notifications` | Central de notificações por franquia (cupom expirando, aviso de orçamento, broadcast) | `NotificationsContext` |
| `stores` | Lojas físicas de cada franquia | — |
| `catalog_imports` | Auditoria de quando/quem importou o catálogo de uma franquia (CSV do cliente) | — |

**Importante sobre segurança:** mesmo multi-tenant, o app mobile só fala direto com o banco pra leitura pública do catálogo (anon key + RLS). Login, carrinho sincronizado e qualquer escrita sensível devem passar por Supabase Auth + RLS de verdade (já no schema) — nunca confie só em filtro feito no app. O passo de "BOOTSTRAP" no fim do `SCHEMA.sql` promove sua primeira conta a `platform_admin`; sem isso ninguém gerencia franquia nenhuma.

## Painel admin (mobile e web)

Fica no próprio app, em `/admin` — no celular pela aba **Conta → Área do lojista**, no navegador direto pela URL (`npx expo start --web` e abra `http://localhost:8081/admin`). Login com **e-mail e senha do Supabase Auth**; só entra quem tem papel `platform_admin` ou `tenant_admin` (ver bootstrap no fim do `SCHEMA.sql`).

| Tela | O que configura |
|---|---|
| Franquias | Lista e cria franquias (só `platform_admin`). `tenant_admin` cai direto na própria franquia. |
| Produtos | Catálogo: nome, categoria, preço (ou preço do kg), EAN, **PLU da balança**, ativo/inativo. |
| Balança | Formato da etiqueta: prefixo, dígitos do PLU, se o código traz **preço total ou peso**, dígitos/casas do valor, conferência do dígito verificador. Tem modelos prontos, desenho do layout e **simulador** (gera uma etiqueta ou lê uma colada e mostra produto, peso e valor). |
| Regras do app | % do orçamento para avisar o cliente e intervalo entre bipagens. |
| Marca e dados | Nome, cor e logo (dono da franquia edita); plano, status, slug e território (só `platform_admin` — o banco recusa o resto). |

Tudo que é por franquia fica na tabela `tenant_settings`. O app do cliente baixa a configuração da franquia dele ao abrir (e guarda no aparelho, para funcionar sem internet).

## Navegação

5 abas: **Início** · **Ofertas** · **Comprar** (scanner, botão elevado no centro) · **Listas** · **Conta** (perfil + cartão de fidelidade + favoritos + histórico + notificações, tudo unificado).
Carrinho, Lojas e Notificações continuam existindo como telas de verdade, só não ficam na barra de abas — ver `href: null` em `src/app/(tabs)/_layout.tsx`.

## Estrutura do projeto

```
src/
  app/              # telas/rotas (Expo Router)
    _layout.tsx       # providers + Stack com (tabs) e admin
    admin/            # painel admin (login, franquias, produtos, balança, regras, marca)
    (tabs)/           # app do cliente (o grupo não aparece na URL)
    index.tsx         # Início
    comprar.tsx        # Scanner (câmera) — núcleo do Scan & Go
    promotions.tsx      # Ofertas (cupons + promoções da loja)
    listas.tsx         # Listas de compras
    profile.tsx          # Conta: login, cartão de fidelidade, favoritos, histórico, orçamento
    cart.tsx            # Carrinho (fora da tab bar)
    historico.tsx       # Histórico completo + comprar novamente (fora da tab bar)
    lojas.tsx           # Lojas físicas da franquia (fora da tab bar)
    notifications.tsx   # Central de notificações (fora da tab bar)
  components/
    ui/                # Design system: Button, Card, Badge, EmptyState, Icon, Section
    ProductRow.tsx      # linha do carrinho (favoritar, quantidade, total)
  context/            # estado global: carrinho, auth, promoções ativadas,
                       # listas, histórico, orçamento, favoritos, notificações
                       # (cada um persistido em AsyncStorage)
  data/               # catálogo, usuários, ofertas, notificações e lojas mock
  theme/tokens.ts      # cores, espaçamento, radius, tipografia, sombras
  types.ts             # tipos compartilhados
  utils/pricing.ts     # cálculo de totais e promoções (arredonda por linha, como o PDV)
  utils/scaleLabel.ts  # leitura/geração da etiqueta de balança (layout parametrizável)
  services/            # Supabase: catálogo, tenant_settings, dados do admin
  utils/loyalty.ts     # nível de fidelidade (Bronze/Prata/Ouro) a partir dos pontos
```

## Como testar agora, sem gerar APK

A forma mais rápida de ver o app funcionando no seu celular é pelo **Expo Go**:

```bash
npm install
npx expo start
```

Abra o app **Expo Go** (Android/iOS) e escaneie o QR code que aparece no terminal. A leitura de código de barras funciona dentro do Expo Go normalmente.

Como o catálogo é fictício, para testar a leitura de um código de barras real, gere uma imagem de código de barras com um dos números cadastrados em `src/data/products.ts` (ex.: `7891000200104`, que tem a promoção "Leve 3 Pague 2") em qualquer gerador online de EAN-13 e aponte a câmera para a tela/impressão.

## Como gerar o APK para baixar e instalar no celular

Este ambiente de nuvem onde o código foi escrito **não tem acesso de rede aos servidores do Android (`dl.google.com`) nem ao serviço de build do Expo (`expo.dev`/`api.expo.dev`)**, então não há como compilar o `.apk` final diretamente nesta sessão. O caminho mais simples é usar o **EAS Build** (serviço de build em nuvem da Expo, gratuito para esse uso) a partir do seu próprio computador ou de um ambiente com acesso a esses domínios:

```bash
npm install -g eas-cli      # ou use npx eas-cli@latest
eas login                   # crie uma conta gratuita em expo.dev se não tiver
eas build -p android --profile preview
```

Isso usa o perfil `preview` já configurado em `eas.json` (gera `.apk` direto, sem precisar de loja de apps). Em alguns minutos o EAS devolve um link para baixar o `.apk` e instalar direto no celular Android (ative "instalar apps de fontes desconhecidas" quando for instalar).

Alternativa sem EAS (build local, precisa de Android Studio/SDK instalado na sua máquina):

```bash
npx expo run:android --variant release
```

## Qualidade

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
```

Ambos passam limpos nesta versão. Também validei que o bundle JS compila corretamente para Android via `npx expo export -p android`.

## Fluxo de branches

- **`main`** = produção. Só recebe código já testado, via Pull Request vindo da `dev`. Nunca commitar direto.
- **`dev`** = desenvolvimento. Todo trabalho do dia a dia vai aqui (ou em branches `feature/...` criadas a partir dela).

```bash
git switch dev
git pull
# ... alterações, commits ...
git push
```

Quando a `dev` estiver estável (typecheck e lint passando, fluxo testado no celular), abra um Pull Request `dev → main` no GitHub e faça o merge. Builds de produção (`eas build`) saem sempre da `main`.

## Próximos passos sugeridos

- Migrar ofertas de cliente (`memberPromotions.ts`) e login (`users.ts`) pro Supabase igual ao catálogo — login precisa passar por uma função/API própria (nunca comparar senha direto do app), não só uma query de leitura.
- Hash de senha de verdade (bcrypt/argon2) e token de sessão (JWT) em vez do mock atual.
- Sincronizar `cart_sessions`/`cart_items` com o backend (histórico de compras, cruzar com o caixa). Hoje **listas, histórico, favoritos e orçamento vivem só no `AsyncStorage` do aparelho** — não sincronizam entre dispositivos nem sobrevivem a reinstalar o app. Se precisar disso, essas 4 entidades também viram tabelas (`shopping_lists`, `shopping_list_items`, `favorites`, `user_budget`) ligadas a `users.id`.
- Imagens de produto: o catálogo mock não tem URLs de imagem, então o carrinho hoje não mostra foto do produto (a UI já está pronta para receber `product.imageUrl` quando o catálogo real tiver isso).
- Adicionar suite de testes automatizados (Jest + React Native Testing Library) — hoje a validação é manual (typecheck, lint, `expo export` e teste do fluxo no dispositivo).
- Ícone e splash screen com a marca do supermercado (hoje usa o placeholder padrão do Expo).
