import { DEFAULT_SCALE_CONFIG, ScaleLabelConfig } from '../utils/scaleLabel';
import { apiRequest } from './api';

/** Tudo que é parametrizável por franquia (tabela tenant_settings). */
export type TenantSettings = {
  scale: ScaleLabelConfig;
  /** % do orçamento a partir do qual o app avisa o cliente. */
  budgetWarningPercent: number;
  /** Intervalo mínimo entre duas bipagens, para não ler o mesmo código duas vezes. */
  scanCooldownMs: number;
};

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  scale: DEFAULT_SCALE_CONFIG,
  budgetWarningPercent: 90,
  scanCooldownMs: 1200,
};

/** Configuração da franquia deste app (rota pública). */
export function fetchAppTenantSettings(): Promise<TenantSettings> {
  return apiRequest<TenantSettings>('/public/settings', { tenant: true });
}

/** Painel admin. */
export function fetchTenantSettings(tenantId: string): Promise<TenantSettings> {
  return apiRequest<TenantSettings>(`/admin/tenants/${tenantId}/settings`, { auth: 'admin' });
}

export function saveTenantSettings(tenantId: string, settings: TenantSettings): Promise<TenantSettings> {
  return apiRequest<TenantSettings>(`/admin/tenants/${tenantId}/settings`, {
    method: 'PUT',
    auth: 'admin',
    body: settings,
  });
}
