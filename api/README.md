# ScanMercado API

Back-end do ScanMercado: app do cliente + painel admin, num PostgreSQL padrão (Railway).

- **Node.js 22+ / TypeScript**, Fastify, `pg`
- **Login próprio**: senha em bcrypt, token JWT ligado a uma sessão no banco — bloquear usuário, redefinir senha ou sair valem na hora
- **Multi-franquia**: toda consulta filtra pela franquia de quem chama
- **Migrações automáticas**: a cada boot a API aplica o que estiver pendente em `migrations/` e cria o admin principal a partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Ninguém roda SQL à mão.

## Deploy no Railway

1. **New Project → Deploy from GitHub repo** → `market-scan`.
2. No projeto: **+ New → Database → PostgreSQL**.
3. No serviço do repositório (a API), em **Settings**:
   - **Root Directory**: `/api`
   - **Config file path**: `/api/railway.json` (build, start e health check já estão nele)
   - **Branch**: `dev` para testar, `main` para produção
4. Em **Variables** do serviço da API:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência ao banco do passo 2) |
   | `JWT_SECRET` | segredo aleatório (gere com o comando abaixo) |
   | `ADMIN_EMAIL` | seu e-mail de admin principal |
   | `ADMIN_PASSWORD` | sua senha (mínimo 8 caracteres) |

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
5. **Settings → Networking → Generate Domain**. Essa URL é o `EXPO_PUBLIC_API_URL` do app.
6. Confira: `https://SUA-URL/health` responde `{"ok":true}`.

No log do deploy aparecem as migrações aplicadas e `admin principal criado: ...`.

## Rodar no seu PC

```bash
cd api
npm install
cp .env.example .env   # preencha DATABASE_URL, JWT_SECRET, ADMIN_*
npm run dev            # http://localhost:3000
```

Para `DATABASE_URL` local, dá para usar a URL pública do Postgres do Railway (aba **Connect** do banco).

## Testes

```bash
npm test
```

Sobem um PostgreSQL de verdade em memória (PGlite) — não precisa de banco instalado. Cobrem login, sessões, papéis, isolamento entre franquias, balança, produtos e usuários.

## Rotas

| Rota | Quem | O quê |
|---|---|---|
| `GET /health` | todos | saúde da API e do banco |
| `GET /public/brand` · `/public/settings` | app (header `x-tenant-id`) | marca e configuração da franquia |
| `GET /public/products/barcode/:code` · `/public/products/plu/:plu` | app | produto do scanner (com promoção ativa) |
| `POST /auth/login` | admins | login do painel (e-mail + senha) |
| `POST /auth/customer/login` | clientes | login do app (CPF + senha, header `x-tenant-id`) |
| `GET /auth/me` · `POST /auth/logout` · `POST /auth/change-password` | logado | sessão |
| `/admin/tenants…` | plataforma; lojista só a própria | franquias, configurações, produtos |
| `/admin/users…` | só plataforma | criar, editar, redefinir senha, bloquear |

## Nova migração

Crie `migrations/004_alguma_coisa.sql` (o número define a ordem). Ela roda sozinha no próximo deploy, numa transação — se falhar, nada é aplicado e o deploy não sobe.

## Promoções, lojas e fidelidade

A migração `003_offers_and_loyalty.sql` unifica as ofertas do clube em `promotions` e preserva as ativações existentes. Ela é aplicada automaticamente no próximo boot da API. As tabelas antigas permanecem para preservar os dados; a aplicação usa `promotion_activations` daqui em diante.

| Rota | Acesso | Comportamento |
|---|---|---|
| `GET /public/offers?storeId=...` | `x-tenant-id` | Ofertas válidas da rede e da loja selecionada; uma oferta geral efetiva por produto |
| `GET /public/stores`, `GET /public/loyalty` | `x-tenant-id` | Lojas ativas e regras concretas do programa |
| `POST /auth/customer/register` | `x-tenant-id` | Nome, CPF validado e senha; cria somente cliente |
| `/admin/tenants/:id/offers` | Plataforma ou lojista da própria franquia | GET/POST; PUT `/:offerId` para editar; DELETE `/:offerId` para pausar |
| `/admin/tenants/:id/stores` | Admin da franquia | GET/POST; PUT `/:storeId` |
| `/admin/tenants/:id/loyalty` | Admin da franquia | GET/PUT do programa |
| `POST /admin/tenants/:id/loyalty/credits` | Admin da franquia | CPF, comprovante único e total confirmado; credita pontos em transação |
| `/customer/activations` | Cliente autenticado | GET; PUT/DELETE `/:id` para ativar/desativar cupom |
| `/customer/rewards` | Cliente autenticado | GET; POST com `requestKey` para trocar pontos de forma idempotente |
| `GET /admin/tenants/:id/rewards` | Admin da franquia | Benefícios emitidos, cliente e estado da entrega |
| `POST /admin/tenants/:id/rewards/:rewardId/redeem` | Admin da franquia | Confirma entrega uma única vez |

Créditos exigem confirmação manual do pagamento pelo lojista. Não há conexão automática com PDV ou emissão de nota fiscal. O identificador do comprovante deve incluir loja/data/número para ser único na rede. Os pontos são inteiros, arredondados para baixo na conversão por real.

Limites de oferta são por compra, em unidades ou kg. Condições textuais são exibidas ao cliente; regras adicionais escritas no texto não se tornam validações automáticas. O scanner e o carrinho são estimativas, sem pagamento ou aplicação direta de desconto no caixa.
