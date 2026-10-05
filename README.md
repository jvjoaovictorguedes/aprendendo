# ScanMercado (app piloto)

App mobile (Expo / React Native) para clientes de supermercado. O cliente **bipa o código de barras** de cada produto com a câmera do celular enquanto faz as compras, e o app vai somando os valores — incluindo promoções — para mostrar uma **prévia do total a pagar** antes de chegar ao caixa.

> Este app **não substitui o caixa**: é uma conferência para o cliente. O valor final é sempre o do PDV do supermercado.

## O que já funciona

**Scan & Go (núcleo do app):**
- Leitura de código de barras (EAN-13, EAN-8, UPC-A, UPC-E, Code128) pela câmera, usando `expo-camera`, com feedback imediato (nome, preço, **desfazer**) e háptico a cada bipagem.
- Busca de produto **real no Supabase** quando configurado (ver seção abaixo), com fallback automático pro catálogo local se o Supabase não estiver configurado ou a chamada falhar — o scanner nunca trava esperando resposta.
- Cada bipagem soma automaticamente ao carrinho (produto repetido = quantidade +1).
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

O catálogo de produtos **já busca no Supabase de verdade** quando configurado — não precisa mudar código, só configurar:

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o arquivo [`SCHEMA.sql`](./SCHEMA.sql) inteiro (cria as tabelas, ativa RLS com leitura pública só em `products`/`promotions`/`member_promotions`/`stores`, e já popula com os mesmos produtos do mock).
3. Em **Project Settings → API**, copie a `Project URL` e a chave `anon public`.
4. Copie `.env.example` para `.env` na raiz do projeto e preencha:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
   ```
5. Reinicie o `npx expo start` (ou gere um novo build) — o scanner (`src/services/catalog.ts`) passa a consultar `products`/`promotions` no Supabase a cada bipagem. Se a tabela não tiver aquele código de barras, aparece "Produto não cadastrado" (mesmo comportamento de antes).

Pra testar com dados seus: edite a tabela `products` direto no **Table Editor** do Supabase (adicionar/mudar preço/criar promoção) e gere uma imagem de código de barras com o mesmo número em qualquer gerador de EAN-13 online.

Sem o `.env` configurado, o app continua funcionando normalmente com o catálogo local mock — nada quebra.

**Importante pro build com EAS:** o `.env` local só vale pra rodar com `npx expo start`. Pra essas variáveis irem também no `.apk` gerado pelo `eas build`, configure-as como variáveis de ambiente do projeto na EAS (`eas env:create` ou pelo site expo.dev → seu projeto → Environment variables, marcando visibilidade "Plain text" para o perfil `preview`) — senão o app buildado cai no catálogo mock mesmo com o Supabase configurado localmente.

## O que é mock (pilot) e precisa de integração real

- **Catálogo de produtos/promoções gerais**: já pode vir do Supabase (ver acima). Sem Supabase configurado, usa `src/data/products.ts`.
- **Ofertas exclusivas de cliente**: `src/data/memberPromotions.ts` — ainda não migrado pro Supabase (próximo passo natural: mesma mecânica do catálogo).
- **Login/usuários**: `src/data/users.ts` + `src/context/AuthContext.tsx` (senha em texto puro só porque é mock — isso NUNCA pode ir pra produção assim). Ponto de integração: a função `login()` dentro de `AuthContext.tsx`.

## Banco de dados (schema esperado)

O arquivo **[`SCHEMA.sql`](./SCHEMA.sql)** na raiz do projeto tem o schema completo em PostgreSQL. As tabelas `products`, `promotions`, `member_promotions` e `stores` têm RLS com leitura pública (é o que o app consulta direto); as demais (`users`, `cart_sessions`, etc.) ficam com RLS ativo e sem política pública — só serão acessadas por uma API própria no futuro, nunca direto do app.

Tabelas principais:

| Tabela | Pra quê serve | Mapeia pra qual tipo no app |
|---|---|---|
| `products` | Catálogo (nome, preço, categoria) | `Product` (`src/types.ts`) |
| `promotions` | Promoções gerais da loja (% off, leve/pague, preço fixo) | `Product.promotion` |
| `member_promotions` | Ofertas exclusivas de cliente logado | `MemberPromotion` (`src/data/memberPromotions.ts`) |
| `users` | Clientes cadastrados (login) | `User` (`src/data/users.ts`) |
| `user_activated_promotions` | Quais ofertas de cliente cada usuário ativou | estado do `PromotionsContext` |
| `cart_sessions` / `cart_items` | Histórico de "passagens pelo mercado" — hoje o carrinho só vive no celular (`AsyncStorage`); essas tabelas são o destino quando o carrinho passar a sincronizar com o backend | `CartItem[]` do `CartContext` |
| `stores` | Suporte a múltiplas lojas/filiais da rede | — |

**Importante sobre segurança:** o app mobile não deve falar direto com o banco. O fluxo real é `app → API HTTP do supermercado → banco`. A API é quem valida login (hash de senha, nunca texto puro como no mock), calcula promoções válidas no momento, etc. O schema é o contrato de dados; a API é quem expõe isso com segurança.

## Navegação

5 abas: **Home** · **Comprar** (scanner) · **Listas** · **Histórico** · **Perfil**.
Carrinho e Promoções continuam existindo como telas de verdade, só não ficam na barra de abas (acessadas a partir da Home/Comprar/Promoções) — ver `href: null` em `src/app/_layout.tsx`.

## Estrutura do projeto

```
src/
  app/              # telas/rotas (Expo Router)
    index.tsx         # Home
    comprar.tsx        # Scanner (câmera) — núcleo do Scan & Go
    listas.tsx         # Listas de compras
    historico.tsx       # Histórico + comprar novamente
    cart.tsx            # Carrinho (fora da tab bar)
    promotions.tsx      # Promoções (fora da tab bar)
    profile.tsx          # Login / perfil / orçamento
  components/
    ui/                # Design system: Button, Card, Badge, EmptyState, Section
    ProductRow.tsx      # linha do carrinho (favoritar, quantidade, total)
  context/            # estado global: carrinho, auth, promoções ativadas,
                       # listas, histórico, orçamento, favoritos (cada um
                       # persistido em AsyncStorage)
  data/               # catálogo, usuários e ofertas mock
  theme/tokens.ts      # cores, espaçamento, radius, tipografia, sombras
  types.ts             # tipos compartilhados
  utils/pricing.ts     # cálculo de totais e promoções
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

## Próximos passos sugeridos

- Migrar ofertas de cliente (`memberPromotions.ts`) e login (`users.ts`) pro Supabase igual ao catálogo — login precisa passar por uma função/API própria (nunca comparar senha direto do app), não só uma query de leitura.
- Hash de senha de verdade (bcrypt/argon2) e token de sessão (JWT) em vez do mock atual.
- Sincronizar `cart_sessions`/`cart_items` com o backend (histórico de compras, cruzar com o caixa). Hoje **listas, histórico, favoritos e orçamento vivem só no `AsyncStorage` do aparelho** — não sincronizam entre dispositivos nem sobrevivem a reinstalar o app. Se precisar disso, essas 4 entidades também viram tabelas (`shopping_lists`, `shopping_list_items`, `favorites`, `user_budget`) ligadas a `users.id`.
- Imagens de produto: o catálogo mock não tem URLs de imagem, então o carrinho hoje não mostra foto do produto (a UI já está pronta para receber `product.imageUrl` quando o catálogo real tiver isso).
- Adicionar suite de testes automatizados (Jest + React Native Testing Library) — hoje a validação é manual (typecheck, lint, `expo export` e teste do fluxo no dispositivo).
- Ícone e splash screen com a marca do supermercado (hoje usa o placeholder padrão do Expo).
