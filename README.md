# ScanMercado (app piloto)

App mobile (Expo / React Native) para clientes de supermercado. O cliente **bipa o código de barras** de cada produto com a câmera do celular enquanto faz as compras, e o app vai somando os valores — incluindo promoções — para mostrar uma **prévia do total a pagar** antes de chegar ao caixa.

> Este app **não substitui o caixa**: é uma conferência para o cliente. O valor final é sempre o do PDV do supermercado.

## O que já funciona

- Leitura de código de barras (EAN-13, EAN-8, UPC-A, UPC-E, Code128) pela câmera, usando `expo-camera`.
- Cada bipagem soma automaticamente ao carrinho (produto repetido = quantidade +1).
- Tela **Carrinho** com lista dos itens, ajuste manual de quantidade, remoção de item e total.
- Motor de promoções simples: `% OFF`, `leve X pague Y` e `preço fixo promocional`, com economia calculada linha a linha e no total.
- Carrinho persistido localmente (`AsyncStorage`) — se o app fechar, o cliente não perde a lista.
- Aviso de "prévia de pagamento" deixando claro que o valor é estimado.

## O que é mock (pilot) e precisa de integração real

O catálogo de produtos/preços/promoções está em `src/data/products.ts`, com ~15 produtos fictícios de exemplo. Em produção isso deve ser substituído por uma chamada à API do supermercado (preço e promoções ao vivo por código de barras). O ponto de integração é a função `findProductByBarcode` nesse arquivo — troque a busca local por uma chamada HTTP ao backend do supermercado e o resto do app (carrinho, cálculo de totais, tela de resumo) continua funcionando sem mudanças.

## Estrutura do projeto

```
src/
  app/            # telas/rotas (Expo Router) — index.tsx = Scanner, cart.tsx = Carrinho
  components/     # componentes de UI (linha do carrinho)
  context/        # estado global do carrinho (React Context + AsyncStorage)
  data/           # catálogo mock de produtos/promoções
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

- Trocar o catálogo mock por uma API real do supermercado (preço, estoque e promoções).
- Autenticação do cliente (CPF/cartão fidelidade) para aplicar promoções personalizadas.
- Tela de histórico de compras.
- Ícone e splash screen com a marca do supermercado (hoje usa o placeholder padrão do Expo).
