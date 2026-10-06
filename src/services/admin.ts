// Acesso a dados do painel admin. Toda permissão é garantida pelo RLS do
// banco (SCHEMA.sql + supabase/migrations) — o app só esconde o que o
// usuário não pode usar, nunca é a única barreira.

import { normalizePlu } from '../utils/scaleLabel';
import { supabase } from './supabase';

export type ProfileRole = 'platform_admin' | 'tenant_admin' | 'customer';

export type AdminProfile = {
  id: string;
  role: ProfileRole;
  tenantId: string | null;
  name: string;
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

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  accent_color: string;
  logo_url: string | null;
  exclusivity_region: string | null;
  is_internal: boolean;
};

function client() {
  if (!supabase) {
    throw new Error(
      'Supabase não configurado. Preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no .env.',
    );
  }
  return supabase;
}

/** Mensagem legível para os erros mais comuns do Postgres/PostgREST. */
export function describeError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  switch (e?.code) {
    case '23505':
      return e?.message?.startsWith('Já existe')
        ? e.message
        : 'Já existe um registro com esse valor (e-mail, slug, código de barras ou PLU repetido).';
    case '23514':
      return 'Algum valor está fora do permitido. Confira os campos.';
    case '42501':
      return 'Você não tem permissão para essa alteração.';
    case 'PGRST116':
      return 'Registro não encontrado ou sem permissão de acesso.';
    default:
      return e?.message ?? 'Erro inesperado. Tente de novo.';
  }
}

function mapTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    plan: row.plan,
    status: row.status,
    accentColor: row.accent_color,
    logoUrl: row.logo_url,
    exclusivityRegion: row.exclusivity_region,
    isInternal: row.is_internal,
  };
}

export async function fetchMyProfile(userId: string): Promise<AdminProfile | null> {
  const { data, error } = await client()
    .from('profiles')
    .select('id, role, tenant_id, name')
    .eq('id', userId)
    .maybeSingle<{ id: string; role: ProfileRole; tenant_id: string | null; name: string }>();
  if (error) throw error;
  return data ? { id: data.id, role: data.role, tenantId: data.tenant_id, name: data.name } : null;
}

export async function listTenants(): Promise<Tenant[]> {
  const { data, error } = await client().from('tenants').select('*').order('name');
  if (error) throw error;
  return (data as TenantRow[]).map(mapTenant);
}

export async function fetchTenant(id: string): Promise<Tenant> {
  const { data, error } = await client().from('tenants').select('*').eq('id', id).single<TenantRow>();
  if (error) throw error;
  return mapTenant(data);
}

export async function createTenant(input: {
  slug: string;
  name: string;
  plan: TenantPlan;
  accentColor: string;
}): Promise<Tenant> {
  const { data, error } = await client()
    .from('tenants')
    .insert({ slug: input.slug, name: input.name, plan: input.plan, accent_color: input.accentColor })
    .select('*')
    .single<TenantRow>();
  if (error) throw error;
  return mapTenant(data);
}

/** tenant_admin só consegue mudar nome/cor/logo — o resto o banco recusa. */
export async function updateTenant(
  id: string,
  patch: Partial<Omit<Tenant, 'id' | 'isInternal'>>,
): Promise<void> {
  const row: Partial<TenantRow> = {};
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.plan !== undefined) row.plan = patch.plan;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.accentColor !== undefined) row.accent_color = patch.accentColor;
  if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl;
  if (patch.exclusivityRegion !== undefined) row.exclusivity_region = patch.exclusivityRegion;

  const { error } = await client().from('tenants').update(row).eq('id', id);
  if (error) throw error;
}

const PRODUCT_COLUMNS = 'id, barcode, plu, name, price, unit, category, active';

function mapProduct(row: AdminProduct): AdminProduct {
  return { ...row, price: Number(row.price) };
}

export async function listProducts(tenantId: string, search: string): Promise<AdminProduct[]> {
  let query = client()
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('tenant_id', tenantId)
    .order('name')
    .limit(200);

  const term = search.trim();
  if (term) {
    // Busca por nome, EAN ou PLU. Remove caracteres que quebram o filtro do PostgREST.
    const safe = term.replace(/[,()*%]/g, ' ');
    query = query.or(`name.ilike.%${safe}%,barcode.ilike.%${safe}%,plu.eq.${normalizePlu(safe) || '0'}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as AdminProduct[]).map(mapProduct);
}

export async function fetchProduct(id: string): Promise<AdminProduct> {
  const { data, error } = await client().from('products').select(PRODUCT_COLUMNS).eq('id', id).single<AdminProduct>();
  if (error) throw error;
  return mapProduct(data);
}

export async function findProductByPlu(tenantId: string, plu: string): Promise<AdminProduct | null> {
  const { data, error } = await client()
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('plu', normalizePlu(plu))
    .maybeSingle<AdminProduct>();
  if (error) throw error;
  return data ? mapProduct(data) : null;
}

export async function saveProduct(tenantId: string, draft: ProductDraft): Promise<void> {
  const row = {
    tenant_id: tenantId,
    barcode: draft.barcode?.trim() || null,
    plu: draft.plu ? normalizePlu(draft.plu) || null : null,
    name: draft.name.trim(),
    price: draft.price,
    unit: draft.unit,
    category: draft.category.trim(),
    active: draft.active,
  };

  const { error } = draft.id
    ? await client().from('products').update(row).eq('id', draft.id)
    : await client().from('products').insert(row);
  if (error) throw error;
}
