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

Crie `migrations/003_alguma_coisa.sql` (o número define a ordem). Ela roda sozinha no próximo deploy, numa transação — se falhar, nada é aplicado e o deploy não sobe.
