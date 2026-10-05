# ScanMercado (app piloto)

App mobile (Expo / React Native) para clientes de supermercado. O cliente **bipa o código de barras** de cada produto com a câmera do celular enquanto faz as compras, e o app vai somando os valores — incluindo promoções — para mostrar uma **prévia do total a pagar** antes de chegar ao caixa.

> Este app **não substitui o caixa**: é uma conferência para o cliente. O valor final é sempre o do PDV do supermercado.

## O que já funciona

- Leitura de código de barras (EAN-13, EAN-8, UPC-A, UPC-E, Code128) pela câmera, usando `expo-camera`.
- Cada bipagem soma automaticamente ao carrinho (produto repetido = quantidade +1).
- Tela **Carrinho** com lista dos itens, ajuste manual de quantidade, remoção de item e total.
- Motor de promoções: `% OFF`, `leve X pague Y` e `preço fixo promocional` (valem pra qualquer cliente, aplicadas automaticamente ao bipar).
- **Login do cliente** (CPF + senha) — aba Perfil, com pontos de fidelidade exibidos após logar.
- **Ofertas exclusivas de cliente logado** (aba Promoções) — o cliente ativa um desconto extra antes de bipar, igual ao padrão do "Meu BH" (Supermercados BH) e "Cliente Mais" (Pão de Açúcar): o desconto entra empilhado em cima da promoção normal do produto.
- Carrinho e ofertas ativadas persistidos localmente (`AsyncStorage`) — se o app fechar, o cliente não perde nada.
- Aviso de "prévia de pagamento" deixando claro que o valor é estimado.

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

## Estrutura do projeto

```
src/
  app/            # telas/rotas (Expo Router)
    index.tsx       # Scanner (câmera)
    promotions.tsx  # Promoções (loja + exclusivas de cliente)
    cart.tsx        # Carrinho
    profile.tsx     # Login / perfil do cliente
  components/     # componentes de UI (linha do carrinho)
  context/        # estado global (carrinho, autenticação, promoções ativadas)
  data/           # catálogo, usuários e ofertas mock
  types.ts        # tipos compartilhados
  utils/pricing.ts# cálculo de totais e promoções
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
- Sincronizar `cart_sessions`/`cart_items` com o backend (histórico de compras, cruzar com o caixa).
- Ícone e splash screen com a marca do supermercado (hoje usa o placeholder padrão do Expo).
