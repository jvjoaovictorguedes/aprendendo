// Usuários do painel (só platform_admin). Leitura e mudança de papel/franquia
// vão direto na tabela profiles (RLS + guard_profile_privileges); criar
// conta, redefinir senha e bloquear passam pela Edge Function admin-users,
// que tem a chave service_role no servidor.

import { FunctionsHttpError } from '@supabase/supabase-js';

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

async function callAdminUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().functions.invoke<T>('admin-users', { body });
  if (error) {
    // A função devolve { error: "mensagem" } — mostra ela em vez do genérico.
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      if (payload?.error) throw new Error(payload.error);
    }
    if (error.message.includes('Failed to send') || error.message.includes('not found')) {
      throw new Error(
        'Edge Function admin-users não encontrada. Faça o deploy dela no Supabase (ver README).',
      );
    }
    throw error;
  }
  return data as T;
}

export function createUser(input: {
  email: string;
  name: string;
  role: 'platform_admin' | 'tenant_admin';
  tenantId: string | null;
}) {
  return callAdminUsers<{ userId: string; temporaryPassword: string }>({ action: 'create', ...input });
}

export function resetUserPassword(userId: string) {
  return callAdminUsers<{ temporaryPassword: string }>({ action: 'reset_password', userId });
}

export function setUserDisabled(userId: string, disabled: boolean) {
  return callAdminUsers<{ ok: true }>({ action: 'set_disabled', userId, disabled });
}
