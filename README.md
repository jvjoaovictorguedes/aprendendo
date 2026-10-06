# ScanMercado (app piloto)

App mobile (Expo / React Native) para clientes de supermercado. O cliente **bipa o código de barras** de cada produto com a câmera do celular enquanto faz as compras, e o app vai somando os valores — incluindo promoções — para mostrar uma **prévia do total a pagar** antes de chegar ao caixa.

> Este app **não substitui o caixa**: é uma conferência para o cliente. O valor final é sempre o do PDV do supermercado.

## O que já funciona

**Scan & Go (núcleo do app):**
- Leitura de código de barras (EAN-13, EAN-8, UPC-A, UPC-E, Code128) pela câmera, usando `expo-camera`, com feedback imediato (nome, preço, **desfazer**) e háptico a cada bipagem.
- Busca de produto **real na API** quando configurada (ver seção abaixo), com fallback automático pro catálogo local se a API não estiver configurada ou a chamada falhar — o scanner nunca trava esperando resposta.
- Cada bipagem soma automaticamente ao carrinho (produto repetido = quantidade +1).
- **Etiqueta de balança** (hortifrúti, açougue, frios): o cliente pesa o produto, a balança imprime um EAN-13 de peso variável com o PLU e o preço (ou peso) embutidos, e o app lê o valor direto do código. Cada produto é cadastrado **uma vez só** (PLU + preço do kg) — qualquer peso funciona. O formato da etiqueta é configurável por franquia (ver "Painel admin").
- Câmera pausa automaticamente quando a aba não está em foco (bateria/privacidade).
- Tela **Carrinho** com lista dos itens, favoritar, ajuste manual de quantidade, remoção e total com hierarquia visual forte.
- Motor de promoções: `% OFF`, `leve X pague Y` e `preço fixo promocional` (gerais da loja), mais **ofertas exclusivas de cliente logado** que se ativam na aba Promoções e empilham sobre a promoção geral.
- **Finalizar compra** de verdade: arquiva a compra no histórico e limpa o carrinho (não é só um alerta).

**Em torno do Scan & Go:**
- **Home**: saudação, CTA "Começar/Continuar comprando", resumo do carrinho atual, ofertas, listas e compras recentes.
- **Login do cliente** (CPF + senha, conferido na API) — aba Conta, com pontos de fidelidade.
- **Listas de compras**: criar, adicionar/remover itens, marcar como comprado; ao bipar na aba Comprar, item que bate com a lista ativa é marcado automaticamente ("✓ Item da sua lista").
- **Histórico de compras**: data, itens, total, economia e **"Comprar novamente"** (adiciona os mesmos itens ao carrinho atual, com preço de hoje).
- **Favoritos** (coração no item do carrinho).
- **Orçamento**: definir um limite na aba Perfil; durante o Scan&Go mostra quanto resta, sem ser alarmista.
- Tudo persistido localmente (`AsyncStorage`) — fechar o app não perde nada.
- Design system centralizado em `src/theme/tokens.ts` + componentes base em `src/components/ui/`.

## Arquitetura

```
App (celular) ─┐
               ├──► API (api/, Node.js) ──► PostgreSQL
Painel (web) ──┘       Railway                Railway
```

- **App e painel admin**: este projeto Expo (mobile e web). Falam só com a API — nunca direto com o banco.
- **API**: pasta [`api/`](./api) — Fastify + `pg`, login próprio (bcrypt + JWT com sessões revogáveis), permissões por papel e isolamento entre franquias. Detalhes, rotas e deploy: [`api/README.md`](./api/README.md).
- **Banco**: PostgreSQL padrão. As migrações ficam em [`api/migrations/`](./api/migrations) e **a própria API aplica no deploy**, junto com a criação do admin principal (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) — ninguém roda SQL à mão.

## Conectando o app à API

1. Suba a API (Railway ou local) — passo a passo em [`api/README.md`](./api/README.md).
2. No `.env` da raiz (ver `.env.example`):
   ```
   EXPO_PUBLIC_API_URL=https://sua-api.up.railway.app
   EXPO_PUBLIC_TENANT_ID=00000000-0000-0000-0000-000000000001
   ```
   O `TENANT_ID` acima é o da franquia piloto que vem nos dados iniciais — troque pelo id de outra franquia pra rodar o app "como" ela.
3. Reinicie com `npx expo start -c`.

A partir daí o scanner consulta o catálogo da franquia na API (`src/services/catalog.ts`), o app aplica a marca e a configuração da balança da franquia, e o login do cliente é conferido no servidor. Sem `EXPO_PUBLIC_API_URL`, o app continua funcionando com o catálogo e o login de demonstração — nada quebra.

**Build com EAS:** o `.env` local só vale pra `npx expo start`. Pra irem no `.apk`, configure `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_TENANT_ID` como variáveis do projeto na EAS (`eas env:create` ou expo.dev → Environment variables, visibilidade "Plain text").

## O que ainda é local/demonstração

- **Ofertas exclusivas de cliente**: `src/data/memberPromotions.ts` — a tabela `member_promotions` já existe na API; falta a rota e ligar o `PromotionsContext`.
- **Ofertas da Home e busca rápida**: usam `src/data/products.ts`.
- **Listas, histórico, favoritos e orçamento**: só no aparelho (`AsyncStorage`). As tabelas `favorites`, `cart_sessions` e `cart_items` já existem para sincronizar.
- **Cadastro do cliente pelo app**: ainda não existe — hoje o cliente entra com CPF + senha já cadastrados (em teste, `SEED_DEMO_CUSTOMER=true` na API cria CPF 12345678900 / senha 123456).

## Banco de dados (multi-tenant)

Um banco para **várias franquias com exclusividade territorial** — cada uma com sua marca, cores, balança e catálogo, sem enxergar os dados das outras. O isolamento é feito pela API: toda consulta filtra pela franquia de quem chama (header `x-tenant-id` no app, franquia do usuário no painel).

Papéis (`users.role`): **`platform_admin`** (equipe ScanMercado — todas as franquias e usuários), **`tenant_admin`** (dono da franquia — só a própria), **`customer`** (cliente do app de uma franquia, entra por CPF).

| Tabela | Pra quê serve |
|---|---|
| `tenants` | Cada franquia: nome, cor, logo, plano, status, território |
| `tenant_settings` | Parametrizações da franquia: layout da etiqueta de balança, aviso de orçamento, intervalo entre bipagens |
| `users` / `sessions` | Login próprio (senha em bcrypt) e sessões revogáveis |
| `products` | Catálogo por franquia, com EAN e/ou **PLU da balança** |
| `promotions` | Promoções da loja (% off, leve/pague, preço fixo) |
| `member_promotions` / `member_promotion_activations` | Ofertas exclusivas de cliente logado |
| `favorites`, `cart_sessions`, `cart_items`, `notifications` | Prontas para sincronizar o que hoje fica no aparelho |
| `stores`, `catalog_imports` | Lojas físicas e auditoria de importação de catálogo |

## Painel admin (mobile e web)

Fica no próprio app, em `/admin` — no celular pela aba **Conta → Área do lojista**, no navegador direto pela URL (`npx expo start --web` e abra `http://localhost:8081/admin`). Login com **e-mail e senha** (contas `platform_admin` ou `tenant_admin`). Quem recebe senha temporária é obrigado a criar a própria senha no primeiro acesso.

| Tela | O que configura |
|---|---|
| Plataforma | Início da equipe ScanMercado: Franquias e Usuários. `tenant_admin` cai direto na própria franquia. |
| Franquias | Lista e cria franquias (já nascem com a configuração padrão). |
| Usuários | Só a plataforma cria acessos: e-mail, nome, papel e franquia. A conta nasce com **senha temporária gerada no servidor**, mostrada uma vez. Também redefine senha e bloqueia/desbloqueia (vale na hora). |
| Produtos | Catálogo: nome, categoria, preço (ou preço do kg), EAN, **PLU da balança**, ativo/inativo. |
| Balança | Formato da etiqueta: prefixo, dígitos do PLU, se o código traz **preço total ou peso**, dígitos/casas do valor, dígito verificador. Modelos prontos, desenho do layout e **simulador**. |
| Regras do app | % do orçamento para avisar o cliente e intervalo entre bipagens. |
| Marca e dados | Nome, cor e logo (dono da franquia edita); plano, status, slug e território (só a plataforma — a API recusa o resto). |

**Teste sem tela de login:** em desenvolvimento, preencha `EXPO_PUBLIC_ADMIN_DEV_EMAIL` e `EXPO_PUBLIC_ADMIN_DEV_PASSWORD` no `.env` e o painel entra sozinho nessa conta. Build de produção ignora essas variáveis — nunca as coloque no EAS.

O app do cliente baixa marca e configuração da franquia ao abrir e guarda no aparelho (abre na hora e funciona sem internet); mudanças feitas no painel valem na próxima abertura.

## Navegação

5 abas: **Início** · **Ofertas** · **Comprar** (scanner, botão elevado no centro) · **Listas** · **Conta** (perfil + cartão de fidelidade + favoritos + histórico + notificações, tudo unificado).
Carrinho, Lojas e Notificações continuam existindo como telas de verdade, só não ficam na barra de abas — ver `href: null` em `src/app/(tabs)/_layout.tsx`.

## Estrutura do projeto

```
api/                 # back-end (Node + PostgreSQL) — ver api/README.md
  migrations/         # schema e dados iniciais, aplicados no deploy
  src/                # rotas, login/sessões, validação
  test/               # testes contra Postgres real em memória
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
  services/            # API: catálogo, marca, tenant_settings, dados do admin
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

- Ligar ofertas de cliente (`memberPromotions.ts`) e cadastro de cliente na API.
- Sincronizar `cart_sessions`/`cart_items` com o backend (histórico de compras, cruzar com o caixa). Hoje **listas, histórico, favoritos e orçamento vivem só no `AsyncStorage` do aparelho** — não sincronizam entre dispositivos nem sobrevivem a reinstalar o app. Se precisar disso, essas 4 entidades também viram tabelas (`shopping_lists`, `shopping_list_items`, `favorites`, `user_budget`) ligadas a `users.id`.
- Imagens de produto: o catálogo mock não tem URLs de imagem, então o carrinho hoje não mostra foto do produto (a UI já está pronta para receber `product.imageUrl` quando o catálogo real tiver isso).
- Adicionar suite de testes automatizados (Jest + React Native Testing Library) — hoje a validação é manual (typecheck, lint, `expo export` e teste do fluxo no dispositivo).
- Ícone e splash screen com a marca do supermercado (hoje usa o placeholder padrão do Expo).
