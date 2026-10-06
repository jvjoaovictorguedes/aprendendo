import { DEFAULT_SCALE_CONFIG, ScaleLabelConfig } from '../utils/scaleLabel';
import { supabase } from './supabase';

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

type TenantSettingsRow = {
  tenant_id: string;
  scale_enabled: boolean;
  scale_prefix: string;
  scale_plu_length: number;
  scale_value_type: 'price' | 'weight';
  scale_value_length: number;
  scale_value_decimals: number;
  scale_validate_check_digit: boolean;
  budget_warning_percent: number;
  scan_cooldown_ms: number;
};

function fromRow(row: TenantSettingsRow): TenantSettings {
  return {
    scale: {
      enabled: row.scale_enabled,
      prefix: row.scale_prefix,
      pluLength: row.scale_plu_length,
      valueType: row.scale_value_type,
      valueLength: row.scale_value_length,
      valueDecimals: row.scale_value_decimals,
      validateCheckDigit: row.scale_validate_check_digit,
    },
    budgetWarningPercent: row.budget_warning_percent,
    scanCooldownMs: row.scan_cooldown_ms,
  };
}

function toRow(tenantId: string, settings: TenantSettings): TenantSettingsRow {
  return {
    tenant_id: tenantId,
    scale_enabled: settings.scale.enabled,
    scale_prefix: settings.scale.prefix,
    scale_plu_length: settings.scale.pluLength,
    scale_value_type: settings.scale.valueType,
    scale_value_length: settings.scale.valueLength,
    scale_value_decimals: settings.scale.valueDecimals,
    scale_validate_check_digit: settings.scale.validateCheckDigit,
    budget_warning_percent: settings.budgetWarningPercent,
    scan_cooldown_ms: settings.scanCooldownMs,
  };
}

/** null quando a franquia ainda não tem linha em tenant_settings. */
export async function fetchTenantSettings(tenantId: string): Promise<TenantSettings | null> {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle<TenantSettingsRow>();
  if (error) throw error;
  return data ? fromRow(data) : null;
}

export async function saveTenantSettings(tenantId: string, settings: TenantSettings): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');
  const { error } = await supabase.from('tenant_settings').upsert(toRow(tenantId, settings));
  if (error) throw error;
}
