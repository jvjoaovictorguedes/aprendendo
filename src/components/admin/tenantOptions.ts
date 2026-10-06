import { useCallback, useEffect, useState } from 'react';

import { describeError, fetchTenant, Tenant, TenantPlan, TenantStatus } from '../../services/admin';

export const STATUS_OPTIONS: { value: TenantStatus; label: string }[] = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'em_configuracao', label: 'Em configuração' },
  { value: 'suspensa', label: 'Suspensa' },
];

export const PLAN_OPTIONS: { value: TenantPlan; label: string }[] = [
  { value: 'padrao', label: 'Padrão' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

export function optionLabel<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Carrega a franquia da rota; reload() depois de salvar. */
export function useTenant(tenantId: string | undefined) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!tenantId) return;
    fetchTenant(tenantId)
      .then((result) => {
        setTenant(result);
        setError(null);
      })
      .catch((err) => setError(describeError(err)));
  }, [tenantId]);

  useEffect(reload, [reload]);

  return { tenant, error, reload };
}
