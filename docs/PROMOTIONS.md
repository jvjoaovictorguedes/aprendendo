# Clube de ofertas e painel do lojista

## Preparação

Use a API PostgreSQL da branch `dev` e configure `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_TENANT_ID` no app. Não coloque senha de banco ou chave JWT em variáveis `EXPO_PUBLIC_*`.

A API aplica a migração `003_offers_and_loyalty.sql` no boot. Ela preserva produtos, ofertas e ativações antigas. Instale com `npm ci` na raiz e em `api/`; execute a API conforme seu README e depois `npm start` (mobile) ou `npm run web` (navegador).

A plataforma cria o acesso do dono em **Admin → Usuários**, com papel de administrador da franquia e sua franquia vinculada. O dono entra em **Conta → Área do lojista** e troca a senha temporária. Ele só acessa produtos, ofertas, lojas e fidelidade da própria rede; não recebe permissão para gerenciar outros usuários ou franquias.

## Configurar e publicar uma oferta

1. Cadastre o produto com preço normal e EAN ou PLU.
2. Cadastre as lojas participantes em **Lojas**.
3. Abra **Promoções e cupons → Nova oferta** e selecione o produto.
4. Escolha **Todos** (percentual, preço fixo ou leve/pague) ou **Clube** (percentual extra para CPF com ativação).
5. Informe início/fim no horário local do dispositivo, loja ou toda a rede, limite e condições. Limites são por compra em unidades ou kg. Leve/pague só vale para produtos por unidade e o limite deve comportar grupos completos.
6. Salve como publicada ou deixe pausada. Ofertas futuras são agendadas; vencidas e pausadas não aparecem para o cliente. É possível editar e pausar sem excluir o histórico.

Entre várias ofertas gerais válidas do mesmo produto, vale a de início mais recente; empates usam o identificador para uma ordem determinística. O app mostra essa mesma oferta no catálogo e no scanner. Entre cupons ativos, vale o maior desconto efetivo, considerando os limites. Cupons dão desconto extra sobre o valor já reduzido pela oferta geral; vários cupons não se somam.

O limite é compartilhado entre as linhas do mesmo produto, inclusive etiquetas diferentes de balança. Valores são arredondados por linha. Condições adicionais em texto são informativas; não criam regras automáticas ou integração com o caixa.

## Compra do cliente

O cadastro pede nome, CPF válido e senha. Não é preciso selecionar uma loja para abrir o app: sem seleção aparecem as ofertas de toda a rede. Uma loja específica adiciona suas ofertas. A troca de loja com itens no carrinho pede confirmação e limpa a prévia, evitando misturar condições de lojas diferentes.

Em **Ofertas**, o cliente vê preços, validade, lojas e condições, pode buscar por produto/categoria e adicionar à lista. As ativações são salvas na conta do clube, não só no aparelho. O scanner mostra o produto adicionado, preço normal, economia e cupons que podem ser ativados ali. A ativação recalcula também produtos já escaneados.

O carrinho separa subtotal, descontos aplicados, total estimado e economia adicional possível com cupons pendentes. Atualiza preços ao abrir, ao retornar ao app e periodicamente; também há atualização manual. Se o servidor não responder, o app informa o erro e não inventa preços do catálogo de demonstração.

Finalizar arquiva a prévia no histórico local. Não efetua pagamento, não aplica descontos no PDV e não gera pontos.

## Fidelidade

Em **Fidelidade**, o dono configura pontos por real, recompensa concreta, pontos necessários e condições. Só o lojista credita uma compra após confirmar o pagamento, identificando CPF, total e comprovante único. Repetir o comprovante não duplica o crédito.

O cliente acompanha saldo e quanto falta para a recompensa. A troca desconta pontos em transação e gera um código vinculado à conta. Repetir uma requisição com a mesma `requestKey` devolve a mesma emissão, sem novo débito. O código aparece na Conta; o lojista confere o cliente/código e registra a entrega uma única vez no admin.

A conversão de pontos é configurável; o crédito e a entrega são manuais. Conectar ERP/PDV para preços, promoções, pagamentos e créditos automáticos continua sendo uma integração separada.

## Validação

```bash
npm ci
npm --prefix api ci
npm run typecheck
npm run lint
npm run test:pricing
npm --prefix api run typecheck
npm --prefix api run build
npm --prefix api test
CI=1 EXPO_OFFLINE=1 npx --no-install expo export --platform android
```

Os testes da API usam PostgreSQL em memória e cobrem migrações, cadastro, isolamento entre franquias, validade, lojas, ativação, resgates e créditos. Os testes de preços cobrem grupos, limites em kg/unidades, cupons, vencimento e centavos.

No dispositivo, valide câmera e leitura de EAN/etiqueta de balança, ativação após escanear, reconexão e troca de loja. As telas web do admin e do cliente podem ser verificadas com uma API local de testes; use contas e dados de teste.

Listas, favoritos e histórico continuam locais. A busca rápida da Home pesquisa os produtos das ofertas disponíveis; o scanner consulta qualquer produto ativo do catálogo. Não há delivery, pagamento online ou sincronização de listas/histórico neste fluxo.
