// Usuários do painel (só platform_admin). Leitura e mudança de papel/franquia
// vão direto na tabela profiles (RLS + guard_profile_privileges); criar
// conta, redefinir senha e bloquear são funções do banco (migração 005),
// que recusam quem não é platform_admin.

import { ProfileRole } from './admin';
import { supabase } from './supabase';

export type ManagedUser = {
  id: string;
  name: string;
  email: string | null;
  role: ProfileRole;
  tenantId: string | null;
  tenantName: string | null;
  disabled: boolean;
  createdAt: string;
};

type ProfileRow = {
  id: string;
  name: string;
  email: string | null;
  role: ProfileRole;
  tenant_id: string | null;
  disabled_at: string | null;
  created_at: string;
  tenants: { name: string } | null;
};

const COLUMNS = 'id, name, email, role, tenant_id, disabled_at, created_at, tenants(name)';

function client() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

function mapUser(row: ProfileRow): ManagedUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    tenantId: row.tenant_id,
    tenantName: row.tenants?.name ?? null,
    disabled: row.disabled_at !== null,
    createdAt: row.created_at,
  };
}

export async function listUsers(filters: {
  search: string;
  tenantId?: string;
  includeCustomers: boolean;
}): Promise<ManagedUser[]> {
  let query = client().from('profiles').select(COLUMNS).order('created_at', { ascending: false }).limit(200);

  if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId);
  if (!filters.includeCustomers) query = query.neq('role', 'customer');

  const term = filters.search.trim().replace(/[,()*%]/g, ' ');
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);

  const { data, error } = await query.returns<ProfileRow[]>();
  if (error) throw error;
  return data.map(mapUser);
}

export async function fetchUser(id: string): Promise<ManagedUser> {
  const { data, error } = await client().from('profiles').select(COLUMNS).eq('id', id).single<ProfileRow>();
  if (error) throw error;
  return mapUser(data);
}

export async function updateUser(
  id: string,
  patch: { name: string; role: ProfileRole; tenantId: string | null },
): Promise<void> {
  const { error } = await client()
    .from('profiles')
    .update({
      name: patch.name,
      role: patch.role,
      tenant_id: patch.role === 'platform_admin' ? null : patch.tenantId,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function createUser(input: {
  email: string;
  name: string;
  role: 'platform_admin' | 'tenant_admin';
  tenantId: string | null;
}): Promise<{ userId: string; temporaryPassword: string }> {
  const { data, error } = await client().rpc('admin_create_user', {
    p_email: input.email,
    p_name: input.name,
    p_role: input.role,
    p_tenant_id: input.tenantId,
  });
  if (error) throw error;
  const result = data as { user_id: string; temporary_password: string };
  return { userId: result.user_id, temporaryPassword: result.temporary_password };
}

export async function resetUserPassword(userId: string): Promise<{ temporaryPassword: string }> {
  const { data, error } = await client().rpc('admin_reset_password', { p_user_id: userId });
  if (error) throw error;
  return { temporaryPassword: data as string };
}

export async function setUserDisabled(userId: string, disabled: boolean): Promise<void> {
  const { error } = await client().rpc('admin_set_user_disabled', { p_user_id: userId, p_disabled: disabled });
  if (error) throw error;
}