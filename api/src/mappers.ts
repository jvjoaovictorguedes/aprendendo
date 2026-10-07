// Conversão linha do banco (snake_case) → JSON da API (camelCase), no mesmo
// formato dos tipos do app (src/types.ts, src/services/*).

import type { AuthUser, Role } from './auth/session.js';

export type TenantRow = {
  id: string;
  slug: string;
  name: string;
  plan: 'padrao' | 'pro' | 'enterprise';
  status: 'ativa' | 'em_configuracao' | 'suspensa';
  accent_color: string;
  logo_url: string | null;
  exclusivity_region: string | null;
  is_internal: boolean;
};

export function toTenant(row: TenantRow) {
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

export type SettingsRow = {
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

export function toSettings(row: SettingsRow) {
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

export type ProductRow = {
  id: string;
  tenant_id: string;
  barcode: string | null;
  plu: string | null;
  name: string;
  price: number;
  unit: 'un' | 'kg';
  category: string;
  active: boolean;
};

export function toAdminProduct(row: ProductRow) {
  return {
    id: row.id,
    barcode: row.barcode,
    plu: row.plu,
    name: row.name,
    price: row.price,
    unit: row.unit,
    category: row.category,
    active: row.active,
  };
}

export type PromotionRow = {
  id?: string;
  starts_at?: Date;
  ends_at?: Date | null;
  max_quantity?: number | null;
  conditions?: string;
  store_id?: string | null;
  kind: 'percent_off' | 'buy_x_pay_y' | 'fixed_price';
  label: string;
  percent: number | null;
  buy_qty: number | null;
  pay_qty: number | null;
  fixed_price: number | null;
};

function toPromotion(row: PromotionRow) {
  const details = row.id
    ? {
        id: row.id,
        startsAt: row.starts_at?.toISOString(),
        endsAt: row.ends_at?.toISOString() ?? null,
        maxQuantity: row.max_quantity ?? null,
        conditions: row.conditions ?? '',
        storeId: row.store_id ?? null,
      }
    : {};
  switch (row.kind) {
    case 'percent_off':
      return {
        kind: 'percentOff' as const,
        percent: row.percent ?? 0,
        label: row.label,
        ...details,
      };
    case 'buy_x_pay_y':
      return {
        kind: 'buyXPayY' as const,
        buy: row.buy_qty ?? 1,
        pay: row.pay_qty ?? 1,
        label: row.label,
        ...details,
      };
    case 'fixed_price':
      return {
        kind: 'fixedPrice' as const,
        price: row.fixed_price ?? 0,
        label: row.label,
        ...details,
      };
  }
}

/** Produto no formato do scanner do app (Product em src/types.ts). */
export function toAppProduct(row: ProductRow, promotion: PromotionRow | null) {
  return {
    // Produto só de balança (sem EAN) é identificado por "plu:<PLU>" no app.
    barcode: row.barcode ?? `plu:${row.plu}`,
    plu: row.plu ?? undefined,
    name: row.name,
    price: row.price,
    unit: row.unit,
    category: row.category,
    promotion: promotion ? toPromotion(promotion) : undefined,
  };
}

export type ManagedUserRow = {
  id: string;
  name: string;
  email: string | null;
  cpf: string | null;
  role: Role;
  tenant_id: string | null;
  tenant_name: string | null;
  disabled_at: Date | null;
  created_at: Date;
  last_login_at: Date | null;
};

export function toManagedUser(row: ManagedUserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    cpf: row.cpf,
    role: row.role,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    disabled: row.disabled_at !== null,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
  };
}

/** Dados de quem está logado (sem nada sensível). */
export function toMe(user: AuthUser) {
  return {
    id: user.id,
    role: user.role,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    cpf: user.cpf,
    points: user.points,
    mustChangePassword: user.mustChangePassword,
  };
}
