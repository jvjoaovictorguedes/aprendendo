# Apresentação ao mercado

A demonstração usa uma loja fictícia separada. Catálogo, preços, benefícios, conta de cliente e avisos são exemplos. O scanner consulta a API e os descontos usam o mesmo cálculo do aplicativo. O caixa simulado não cobra, não emite documento fiscal, não credita pontos e não confirma compras no PDV.

## Preparar

No serviço da API em desenvolvimento, mantenha as variáveis de PostgreSQL e JWT existentes e configure:

```dotenv
DEMO_ENABLED=true
DEMO_OWNER_PASSWORD=defina-uma-senha-privada-para-o-lojista
PUSH_ENABLED=false
```

Reinicie o serviço. A migração `005_demo.sql` adiciona a identificação da loja fictícia e os registros de simulação. A primeira inicialização cria 10 produtos, quatro ofertas, uma loja, uma conta de cliente com 1.250 pontos de exemplo e um lojista. Reinicializações seguintes preservam as alterações feitas para apresentar. Outras lojas não são alteradas.

No `.env` do aplicativo de apresentação:

```dotenv
EXPO_PUBLIC_API_URL=https://market-scan-production-260c.up.railway.app
EXPO_PUBLIC_TENANT_ID=55555555-5555-4555-8555-555555555555
```

Use o endereço do serviço de desenvolvimento se ele for diferente. A URL não termina em `/api`. Nunca coloque a senha do lojista em uma variável `EXPO_PUBLIC_*`. Reinicie o Expo com `npm run start -- --clear` após trocar o ambiente; em um build, as variáveis públicas precisam ser configuradas antes da compilação.

Alternativa para preparar pela linha de comando, com `api/.env` configurado:

```sh
cd api
npm run demo:seed
```

O cliente entra pelo botão **Entrar como cliente de exemplo** em `/demonstracao`. O cadastro de novas contas é bloqueado nesta loja: não use dados pessoais reais na apresentação. O lojista entra em `/admin` com `demo@scanmercado.example` e a senha privada definida no servidor. Esses acessos não representam contas de produção.

## Roteiro de 8 minutos

1. Abra o app e toque na faixa **DEMONSTRAÇÃO**. Entre como cliente de exemplo. Mostre a loja e crie uma lista de compras.
2. Em **Ofertas**, ative o desconto de 10% do arroz no clube. Mostre validade e limites. O lojista pode mudar uma oferta no painel e atualizar a tela do aplicativo para conferir.
3. Imprima [as etiquetas fictícias](ETIQUETAS_DEMO.html) a 100%. Escaneie o arroz e a carne `2000100019603`. Sem câmera disponível, use os botões do roteiro: eles consultam os mesmos códigos na API.
4. Confira arroz R$ 24,90 → R$ 22,41 com o clube e carne total R$ 19,60. Com uma unidade de arroz e uma etiqueta de carne, o total esperado é R$ 42,01 e a economia R$ 2,49. R$ 37,90 é o preço por kg; o peso de aproximadamente 0,517 kg é estimado do preço, pois a etiqueta não informa o peso exato.
5. Mostre o carrinho, o orçamento e a lista. Volte ao roteiro e toque em **Simular conferência no caixa**. Explique que o desconto no caixa real dependerá da integração acordada com o fornecedor do PDV.
6. Toque em **Simular aviso de oferta**. Abra o aviso na central para mostrar o retorno à oferta. Este aviso é fictício e não dispara push. A regra básica de recorrência já existe; a apresentação não usa aprendizagem de máquina.
7. Abra o painel do lojista: produtos, ofertas, lojas, balança, fidelidade e marca. Faça uma alteração simples e mostre o resultado no app.
8. Combine o próximo passo: autorização para catálogo/preços, documentação do PDV e teste piloto em loja. Essas integrações não fazem parte desta demonstração.

## Repetir a apresentação

No painel da loja fictícia, toque **Restaurar dados da demonstração** e confirme. Isso restaura preços, ofertas com validade de mais 30 dias, configuração da balança, loja, fidelidade e pontos fictícios. Também remove simulações, avisos, carrinhos remotos, preferências, dispositivos e registros de compra/resgate dessa loja. O catálogo é recriado; produtos adicionados na apresentação são removidos e lojas adicionais são desativadas. As sessões do cliente de exemplo são encerradas; a sessão do lojista permanece aberta.

No aplicativo configurado para o UUID de demonstração, a restauração também limpa carrinho, listas, favoritos, histórico, orçamento e login do cliente deste dispositivo. **Limpar esta sessão de apresentação**, no roteiro, limpa somente o dispositivo; não restaura o catálogo do servidor. Outros aparelhos devem limpar a sessão e entrar novamente. Se tiver alterado a marca, feche e reabra o aplicativo para recarregar as cores e o logo.

Na linha de comando, `npm run demo:seed -- --reset` faz a mesma restauração do servidor. Desative `DEMO_ENABLED` para bloquear as ferramentas de simulação e restauração. A loja continua identificada como fictícia. Ela é excluída da rotina de push mesmo quando `PUSH_ENABLED=true` em um servidor compartilhado.

Para atualizar as etiquetas depois de ajustar o catálogo de exemplo no código: `cd api && npm run demo:labels`. Mudanças feitas só no painel não regeneram o HTML.

## Validação antes de mostrar ao cliente

- Android físico: navegação por gestos e por três botões, teclado aberto/fechado, letras ampliadas e scanner com as etiquetas impressas.
- iPhone físico: área segura, barra inferior e permissão da câmera. A validação no navegador não substitui esses testes.
- Rede: abrir com internet lenta, tentar ler um código desconhecido e recuperar após uma falha da API.
- Oferta: conferir início/fim de validade, ativação do clube, limite de quantidade e cálculo do leve 3/pague 2 do leite.
- Apresentação: abrir os dois acessos, simular o caixa, abrir o aviso e restaurar dados antes de começar.
- Push real: fazer teste separado com consentimento, build de desenvolvimento, credenciais FCM/APNs e uma loja de teste que não seja marcada como demonstração. Confira o documento [NOTIFICATIONS.md](NOTIFICATIONS.md). Não prometa entrega com o celular bloqueado com base no aviso da central.

Esta entrega prepara a apresentação. A operação comercial ainda depende da integração de catálogo/PDV, homologação física, publicação, manutenção e acordo com o mercado.

## Verificações nesta entrega

Em 07/10/2026: 77 testes da API, nove de preços e cinco de etiquetas passaram (91 ao todo). Typecheck do aplicativo e da API, build da API e lint sem erros também passaram. O fluxo pelo navegador confirmou login, ativação do arroz, carne de R$ 19,60, total de R$ 42,01, caixa simulado, aviso na central e restauração pelo lojista. A API usada na validação tinha banco isolado; não houve acesso ao banco do mercado nem envio de push real. Testes em aparelhos físicos permanecem pendentes.
