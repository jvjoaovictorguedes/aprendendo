// Cliente da API do ScanMercado (api/ — Railway). Todo acesso a dados do app
// e do painel admin passa por aqui.

const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
export function resolveAssetUrl(url: string | null): string | null {
  return url?.startsWith('/public/tenant-logos/') ? `${apiUrl}${url}` : url;
}
// Qual franquia (tenant) este build do app representa. Vai no header
// x-tenant-id das rotas públicas — a API filtra tudo por ela.
export const appTenantId = process.env.EXPO_PUBLIC_TENANT_ID || null;

/** Há uma API configurada (o painel admin precisa só disso). */
export const isApiAvailable = Boolean(apiUrl);

/** O app do cliente usa dados reais (precisa também da franquia). */
export const isApiConfigured = Boolean(apiUrl && appTenantId);

if (!isApiConfigured) {
  console.warn(
    'API não configurada (EXPO_PUBLIC_API_URL / EXPO_PUBLIC_TENANT_ID ausentes). ' +
      'O app vai usar o catálogo local (src/data/products.ts) como alternativa.',
  );
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Token do painel admin (o do cliente do app fica no AuthContext).
let adminToken: string | null = null;

export function setAdminToken(token: string | null) {
  adminToken = token;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** 'admin' usa o token do painel; uma string é usada como token. */
  auth?: 'admin' | string;
  /** Manda o header x-tenant-id da franquia do app. */
  tenant?: boolean;
  query?: Record<string, string | boolean | undefined | null>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!apiUrl) {
    throw new ApiError(0, 'API não configurada: preencha EXPO_PUBLIC_API_URL no .env.');
  }

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.tenant && appTenantId) headers['x-tenant-id'] = appTenantId;
  const token = options.auth === 'admin' ? adminToken : options.auth;
  if (token) headers.authorization = `Bearer ${token}`;

  const params = Object.entries(options.query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  let response: Response;
  let text: string;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    response = await fetch(`${apiUrl}${path}${params ? `?${params}` : ''}`, {
      signal: controller.signal,
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    text = await response.text();
  } catch {
    throw new ApiError(
      0,
      controller.signal.aborted
        ? 'O servidor demorou a responder. Tente novamente.'
        : 'Sem conexão com o servidor. Confira a internet e tente de novo.',
    );
  } finally {
    clearTimeout(timeout);
  }

  let data: { error?: string } | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Resposta que não é JSON (ex.: página de erro do proxy) — fica só o status.
  }
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? `Erro ${response.status} no servidor.`);
  }
  return data as T;
}
