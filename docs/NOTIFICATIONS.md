# Lembretes e ofertas personalizadas

O app usa Expo Push Service: o servidor envia e Android/iOS podem apresentar a notificação com o app fechado ou com o celular bloqueado, conforme a permissão e as configurações do sistema. A execução do app em segundo plano não é necessária para escolher e enviar os avisos. Não há garantia de entrega imediata: rede, modo Foco, bateria e parada forçada do app podem impedir ou atrasar a apresentação.

## Preferências do cliente

Em **Conta**, o cliente ativa **Notificações**. Só nesse momento o app pede a permissão do sistema e registra o token do celular na API. A configuração inicial não solicita permissão automaticamente. Android recebe um canal chamado “Ofertas e lembretes de compra”. Web e Expo Go exibem uma explicação e não fingem registrar um dispositivo push.

Ao ativar, os lembretes de carrinho são habilitados. **Ofertas dos produtos que compro** exige uma segunda escolha explícita e começa desligada. O cliente pode desligar cada tipo ou todas as notificações. As preferências dos tipos são da conta, compartilhadas entre aparelhos; o registro de push é por instalação. Sair da conta invalida a sessão vinculada e impede envios para ela. Trocar de conta na mesma instalação transfere o dispositivo para a conta atual. Revogar a permissão no sistema suspende o registro quando o app volta a abrir.

## Regras iniciais

- Carrinho com itens, não concluído e sem atividade por **120 minutos**: um lembrete. Só considera carrinhos ativos nas últimas 24 horas. Inclui uma oferta vigente de um item quando disponível; caso contrário, oferece continuar a compra. Cada carrinho recebe no máximo um lembrete.
- Produto presente em **três compras declaradas distintas nos últimos 90 dias**: quando houver uma oferta vigente desse produto na loja selecionada, gera um aviso. Cada oferta é anunciada uma vez por cliente. Sem seleção, considera somente ofertas válidas em todas as lojas.
- No máximo **um aviso gerado a cada 24 horas por cliente**, entre **8h e 22h** no fuso `America/Sao_Paulo`. Um aviso pode ser entregue em mais de um aparelho autorizado do cliente. Lembretes do carrinho têm prioridade. Avisos locais de orçamento são independentes dessas campanhas.
- Produtos indisponíveis, lojas inativas e ofertas pausadas, futuras ou vencidas não são anunciados. Uma oferta do clube informa que precisa ser ativada. Antes de um retry, o servidor verifica novamente consentimento, sessão, carrinho e validade; o texto da oferta é atualizado e o TTL não ultrapassa sua validade (até uma hora).

**Já comprei no caixa** registra uma compra declarada pelo cliente, arquiva a prévia no histórico local e limpa o carrinho. **Salvar prévia no histórico** apenas arquiva a estimativa e não alimenta a regra de frequência. Nenhuma ação realiza pagamento, verifica comprovante ou concede pontos. Para confirmar compras com certeza, será necessária integração com o PDV.

## Dados e base para um modelo futuro

A migração `004_customer_engagement.sql` cria preferências, dispositivos, carrinho sincronizado, compras declaradas com itens e uma fila persistente de notificações. Carrinhos são sincronizados após alterações, a cada minuto enquanto o app está ativo e ao mudar para segundo plano. A última alteração pendente fica salva no aparelho e tenta novamente quando há atividade/conexão. Se o celular perder a rede e nunca reabrir o app, a API poderá usar uma cópia antiga; ela não tem como saber da alteração offline.

Revisões impedem que sincronizações antigas substituam dados recentes. A confirmação é idempotente por chave da requisição **e por carrinho**, para uma repetição não virar outra compra. Há um carrinho atual por conta; em múltiplos aparelhos prevalece a maior revisão baseada no relógio do aparelho. O histórico visual permanece local; os registros declarados no servidor alimentam as regras.

Compras têm `source=self_reported`. Avisos têm `rule_version=rules-v1`, tipo, produto/oferta, criação, leitura e abertura; entregas guardam tentativas, tickets e recibos. Esses dados permitem avaliar respostas às recomendações e, futuramente, treinar um modelo. Nesta versão não há modelo treinado nem alegação de aprendizado automático. Os critérios são regras fixas. Produtos são identificados pelo cadastro exato, sem inferir equivalência entre marcas.

## Ativação no ambiente

1. Publique a API. O bootstrap aplica a migração `004` automaticamente. Mantenha o serviço da API em execução para a rotina funcionar.
2. Configure as credenciais de push do projeto EAS `3aaa6cfc-feb2-4f05-9def-8cfed74ce8c5`: **FCM v1** no Android e **APNs** no iOS. Use `eas credentials` no seu ambiente autenticado. O aplicativo já possui `expo-notifications`, seu plugin e `projectId`.
3. Se Enhanced Push Security estiver habilitado no painel EAS, configure `EXPO_ACCESS_TOKEN` apenas no servidor. Sem essa opção, o token é opcional.
4. No Railway, defina `PUSH_ENABLED=true`, `CART_REMINDER_MINUTES=120` e `PUSH_TIMEZONE=America/Sao_Paulo`. A flag começa `false` para permitir preparar/testar as credenciais antes dos envios.
5. Gere/instale um build EAS `preview` ou `production` com as variáveis de API e franquia corretas. Push remoto não pode ser validado pelo navegador ou Expo Go. Para iOS, configure também o bundle identifier e o provisionamento do seu app no EAS.
6. Entre como cliente, ative as notificações, autorize o sistema, adicione um item e coloque o app em segundo plano. Para uma verificação controlada, use `CART_REMINDER_MINUTES=15` (mínimo aceito) e mantenha o teste entre 8h e 22h. Confira recebimento com a tela bloqueada e abertura do carrinho ao tocar. Retorne a 120 após o teste.

A fila usa leases e retry com backoff para falhas de transporte; consulta recibos a partir de 15 minutos, até 24 horas. `DeviceNotRegistered` desativa tokens inválidos. O ticket do Expo indica aceitação, não exibição ao usuário; `delivered` significa confirmação pelo provedor, não leitura. Envios podem se repetir se o serviço aceitou uma mensagem e a conexão caiu antes da resposta (entrega at-least-once). A deduplicação limita a criação de avisos, sem prometer exactly-once no sistema de push.

## Rotas e verificação

Todas as rotas exigem sessão de cliente. A franquia e o usuário vêm da sessão, não do corpo/header do solicitante.

| Rota                                       | Uso                                                        |
| ------------------------------------------ | ---------------------------------------------------------- |
| GET/PUT `/customer/preferences`            | Consentimento por tipo                                     |
| PUT `/customer/devices`                    | Registrar ou atualizar instalação/token                    |
| DELETE `/customer/devices/:installationId` | Desativar instalação da própria conta                      |
| PUT `/customer/cart`                       | Sincronizar produtos/quantidades/loja/revisão              |
| POST `/customer/purchases`                 | Confirmar compra declarada, sem confiar em preços enviados |
| GET `/customer/notifications`              | Central do cliente                                         |
| POST `/customer/notifications/:id/read`    | Leitura e abertura da própria notificação                  |

`cd api && npm test` verifica consentimento, isolamento, regras, duplicação, horário, fila, logout e recibos usando PostgreSQL em memória e transporte de push falso. Não envia notificações para celulares reais. TypeScript, lint, fluxo web e export Android complementam essa validação; o teste físico depende das credenciais e do build instalado.
