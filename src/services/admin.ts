// Acesso a dados do painel admin pela API. Toda permissão é garantida pela
// API (api/src/routes) — o app só esconde o que o usuário não pode usar,
// nunca é a única barreira.

import { ApiError, apiRequest } from './api';

export type ProfileRole = 'platform_admin' | 'tenant_admin' | 'customer';

/** Quem está logado no painel (GET /auth/me). */
export type AdminProfile = {
  id: string;
  role: ProfileRole;
  tenantId: string | null;
  name: string;
  email: string | null;
  mustChangePassword: boolean;
};

export type TenantPlan = 'padrao' | 'pro' | 'enterprise';
export type TenantStatus = 'ativa' | 'em_configuracao' | 'suspensa';

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  accentColor: string;
  logoUrl: string | null;
  exclusivityRegion: string | null;
  isInternal: boolean;
};

export type AdminProduct = {
  id: string;
  barcode: string | null;
  plu: string | null;
  name: string;
  price: number;
  unit: 'un' | 'kg';
  category: string;
  active: boolean;
};

export type ProductDraft = Omit<AdminProduct, 'id'> & { id?: string };

/** Mensagem para mostrar na tela (a API já devolve em português). */
export function describeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Erro inesperado. Tente de novo.';
}

export function listTenants(): Promise<Tenant[]> {
  return apiRequest<Tenant[]>('/admin/tenants', { auth: 'admin' });
}

export function fetchTenant(id: string): Promise<Tenant> {
  return apiRequest<Tenant>(`/admin/tenants/${id}`, { auth: 'admin' });
}

export function createTenant(input: {
  slug: string;
  name: string;
  plan: TenantPlan;
  accentColor: string;
}): Promise<Tenant> {
  return apiRequest<Tenant>('/admin/tenants', { method: 'POST', auth: 'admin', body: input });
}

/** tenant_admin só consegue mudar nome/cor/logo — o resto a API recusa. */
export function updateTenant(id: string, patch: Partial<Omit<Tenant, 'id' | 'isInternal'>>): Promise<Tenant> {
  return apiRequest<Tenant>(`/admin/tenants/${id}`, { method: 'PATCH', auth: 'admin', body: patch });
}

export function listProducts(tenantId: string, search: string): Promise<AdminProduct[]> {
  return apiRequest<AdminProduct[]>(`/admin/tenants/${tenantId}/products`, {
    auth: 'admin',
    query: { search: search.trim() },
  });
}

export function fetchProduct(id: string): Promise<AdminProduct> {
  return apiRequest<AdminProduct>(`/admin/products/${id}`, { auth: 'admin' });
}

export async function findProductByPlu(tenantId: string, plu: string): Promise<AdminProduct | null> {
  try {
    return await apiRequest<AdminProduct>(`/admin/tenants/${tenantId}/products/plu/${encodeURIComponent(plu)}`, {
      auth: 'admin',
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function saveProduct(tenantId: string, draft: ProductDraft): Promise<AdminProduct> {
  const { id, ...body } = draft;
  return id
    ? apiRequest<AdminProduct>(`/admin/products/${id}`, { method: 'PUT', auth: 'admin', body })
    : apiRequest<AdminProduct>(`/admin/tenants/${tenantId}/products`, { method: 'POST', auth: 'admin', body });
}
