import { z } from 'zod';

const booleanFromEnv = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL é obrigatória (no Railway: ${{Postgres.DATABASE_URL}})'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  // Origens liberadas no navegador (painel web). Vazio = qualquer origem; o
  // token vai no header Authorization (sem cookie), então isso é seguro.
  CORS_ORIGINS: z.string().default(''),
  SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  // Quantos proxies ficam na frente da API (Railway: 1). O IP do cliente é
  // lido do X-Forwarded-For só até esse ponto — confiar em todos deixaria
  // qualquer um forjar o IP e escapar do limite de tentativas de login.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  PUSH_ENABLED: booleanFromEnv,
  DEMO_ENABLED: booleanFromEnv,
  DEMO_OWNER_PASSWORD: z.string().min(8).optional(),
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
  CART_REMINDER_MINUTES: z.coerce.number().int().min(15).max(1440).default(120),
  PUSH_TIMEZONE: z
    .string()
    .default('America/Sao_Paulo')
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Fuso horário inválido'),

  // Admin principal criado no primeiro boot (se ainda não existir).
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z
    .string()
    .min(8, 'ADMIN_PASSWORD precisa ter pelo menos 8 caracteres')
    .optional(),
  ADMIN_NAME: z.string().default('Equipe ScanMercado'),

  // Cliente de teste (CPF 12345678900 / senha 123456) na franquia piloto.
  // Só para ambiente de teste — deixe desligado em produção.
  SEED_DEMO_CUSTOMER: booleanFromEnv,
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `- ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Configuração inválida:\n${problems.join('\n')}`);
  }
  return parsed.data;
}
