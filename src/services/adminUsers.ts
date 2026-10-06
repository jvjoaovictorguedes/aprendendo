// Usuários do painel (só platform_admin) — rotas /admin/users da API.

import { ProfileRole } from './admin';
import { apiRequest } from './api';

export type ManagedUser = {
  id: string;
  name: string;
  email: string | null;
  cpf: string | null;
  role: ProfileRole;
  tenantId: string | null;
  tenantName: string | null;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export function listUsers(filters: {
  search: string;
  tenantId?: string;
  includeCustomers: boolean;
}): Promise<ManagedUser[]> {
  return apiRequest<ManagedUser[]>('/admin/users', {
    auth: 'admin',
    query: { search: filters.search.trim(), tenantId: filters.tenantId, includeCustomers: filters.includeCustomers },
  });
}

export function fetchUser(id: string): Promise<ManagedUser> {
  return apiRequest<ManagedUser>(`/admin/users/${id}`, { auth: 'admin' });
}

export function updateUser(
  id: string,
  patch: { name: string; role: ProfileRole; tenantId: string | null },
): Promise<ManagedUser> {
  return apiRequest<ManagedUser>(`/admin/users/${id}`, { method: 'PATCH', auth: 'admin', body: patch });
}

/** Cria acesso ao painel; a senha temporária é trocada no primeiro login. */
export async function createUser(input: {
  email: string;
  name: string;
  role: 'platform_admin' | 'tenant_admin';
  tenantId: string | null;
}): Promise<{ userId: string; temporaryPassword: string }> {
  const result = await apiRequest<{ user: ManagedUser; temporaryPassword: string }>('/admin/users', {
    method: 'POST',
    auth: 'admin',
    body: input,
  });
  return { userId: result.user.id, temporaryPassword: result.temporaryPassword };
}

export function resetUserPassword(userId: string): Promise<{ temporaryPassword: string }> {
  return apiRequest<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`, {
    method: 'POST',
    auth: 'admin',
  });
}

export async function setUserDisabled(userId: string, disabled: boolean): Promise<void> {
  await apiRequest(`/admin/users/${userId}/disable`, { method: 'POST', auth: 'admin', body: { disabled } });
}
