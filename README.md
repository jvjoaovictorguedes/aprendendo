# ScanMercado (app piloto)

App mobile (Expo / React Native) para clientes de supermercado. O cliente **bipa o código de barras** de cada produto com a câmera do celular enquanto faz as compras, e o app vai somando os valores — incluindo promoções — para mostrar uma **prévia do total a pagar** antes de chegar ao caixa.

> Este app **não substitui o caixa**: é uma conferência para o cliente. O valor final é sempre o do PDV do supermercado.

## O que já funciona

**Scan & Go (núcleo do app):**
- Leitura de código de barras (EAN-13, EAN-8, UPC-A, UPC-E, Code128) pela câmera, usando `expo-camera`, com feedback imediato (nome, preço, **desfazer**) e háptico a cada bipagem.
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

## O que é mock (pilot) e precisa de integração real

- **Catálogo de produtos/promoções**: `src/data/products.ts` (~15 produtos fictícios). Ponto de integração: função `findProductByBarcode`.
- **Ofertas exclusivas de cliente**: `src/data/memberPromotions.ts`. Ponto de integração: `findMemberPromotionsByBarcode`.
- **Login/usuários**: `src/data/users.ts` + `src/context/AuthContext.tsx` (senha em texto puro só porque é mock — isso NUNCA pode ir pra produção assim). Ponto de integração: a função `login()` dentro de `AuthContext.tsx` — troque a busca local por uma chamada à API de autenticação do supermercado.

Em todos os casos, troque a busca local por uma chamada HTTP ao backend do supermercado mantendo o mesmo formato de retorno (ver tipos em `src/types.ts`), e o resto do app (carrinho, promoções, telas) continua funcionando sem mudanças.

## Banco de dados (schema esperado)

O arquivo **[`SCHEMA.sql`](./SCHEMA.sql)** na raiz do projeto tem o schema completo em PostgreSQL, com dados de teste já populados (os mesmos produtos/usuários/promoções do mock). Rode ele inteiro num banco Postgres vazio — por exemplo criando um projeto grátis no [Supabase](https://supabase.com) e colando no SQL Editor — pra já ter algo pra testar.

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

- Trocar catálogo, promoções e login mock por chamadas à API real do supermercado (ver `SCHEMA.sql`).
- Hash de senha de verdade (bcrypt/argon2) e token de sessão (JWT) em vez do mock atual.
- Sincronizar `cart_sessions`/`cart_items` com o backend (histórico de compras, cruzar com o caixa). Hoje **listas, histórico, favoritos e orçamento vivem só no `AsyncStorage` do aparelho** — não sincronizam entre dispositivos nem sobrevivem a reinstalar o app. Se precisar disso, essas 4 entidades também viram tabelas (`shopping_lists`, `shopping_list_items`, `favorites`, `user_budget`) ligadas a `users.id`.
- Imagens de produto: o catálogo mock não tem URLs de imagem, então o carrinho hoje não mostra foto do produto (a UI já está pronta para receber `product.imageUrl` quando o catálogo real tiver isso).
- Adicionar suite de testes automatizados (Jest + React Native Testing Library) — hoje a validação é manual (typecheck, lint, `expo export` e teste do fluxo no dispositivo).
- Ícone e splash screen com a marca do supermercado (hoje usa o placeholder padrão do Expo).
