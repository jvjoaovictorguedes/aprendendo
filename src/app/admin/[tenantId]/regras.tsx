import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  AdminPage,
  AdminSection,
  Field,
  FieldRow,
  Loading,
  Status,
  StatusMessage,
} from '../../../components/admin/AdminUI';
import { useTenant } from '../../../components/admin/tenantOptions';
import { Button } from '../../../components/ui';
import { describeError } from '../../../services/admin';
import {
  DEFAULT_TENANT_SETTINGS,
  fetchTenantSettings,
  saveTenantSettings,
  TenantSettings,
} from '../../../services/tenantSettings';

// Mesmos limites do check constraint de tenant_settings no banco.
const LIMITS = {
  budgetWarningPercent: { min: 50, max: 100 },
  scanCooldownMs: { min: 300, max: 5000 },
};

function rangeError(value: number, { min, max }: { min: number; max: number }): string | null {
  if (!Number.isInteger(value)) return 'Digite um número inteiro.';
  if (value < min || value > max) return `Use um valor entre ${min} e ${max}.`;
  return null;
}

export default function AppRulesScreen() {
  const router = useRouter();
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const { tenant } = useTenant(tenantId);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [budgetWarning, setBudgetWarning] = useState('');
  const [cooldown, setCooldown] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTenantSettings(tenantId)
      .then((result) => {
        const loaded = result ?? DEFAULT_TENANT_SETTINGS;
        setSettings(loaded);
        setBudgetWarning(String(loaded.budgetWarningPercent));
        setCooldown(String(loaded.scanCooldownMs));
      })
      .catch((err) => setStatus({ kind: 'error', message: describeError(err) }));
  }, [tenantId]);

  const budgetWarningError = rangeError(Number(budgetWarning), LIMITS.budgetWarningPercent);
  const cooldownError = rangeError(Number(cooldown), LIMITS.scanCooldownMs);

  const handleSave = async () => {
    if (!settings || budgetWarningError || cooldownError) return;
    setIsSaving(true);
    try {
      const next: TenantSettings = {
        ...settings,
        budgetWarningPercent: Number(budgetWarning),
        scanCooldownMs: Number(cooldown),
      };
      await saveTenantSettings(tenantId, next);
      setSettings(next);
      setStatus({ kind: 'success', message: 'Regras salvas.' });
    } catch (err) {
      setStatus({ kind: 'error', message: describeError(err) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPage
      title="Regras do app"
      subtitle={tenant?.name}
      onBack={() => router.push({ pathname: '/admin/[tenantId]', params: { tenantId } })}
      backLabel={tenant?.name ?? 'Franquia'}
    >
      {!settings ? (
        status ? <StatusMessage status={status} /> : <Loading />
      ) : (
        <AdminSection title="Scanner e orçamento" description="Valem para todos os clientes desta franquia.">
          <FieldRow>
            <Field
              label="Aviso de orçamento (%)"
              value={budgetWarning}
              onChangeText={(value) => {
                setBudgetWarning(value.replace(/\D/g, ''));
                setStatus(null);
              }}
              keyboardType="number-pad"
              maxLength={3}
              error={budgetWarningError}
              hint="O cliente é avisado quando a compra chega a esse % do orçamento que ele definiu."
            />
            <Field
              label="Intervalo entre bipagens (ms)"
              value={cooldown}
              onChangeText={(value) => {
                setCooldown(value.replace(/\D/g, ''));
                setStatus(null);
              }}
              keyboardType="number-pad"
              maxLength={4}
              error={cooldownError}
              hint="Evita ler o mesmo código duas vezes. 1200 ms funciona bem na maioria dos celulares."
            />
          </FieldRow>
          <StatusMessage status={status} />
          <Button
            label="Salvar regras"
            onPress={handleSave}
            loading={isSaving}
            disabled={Boolean(budgetWarningError || cooldownError)}
          />
        </AdminSection>
      )}
    </AdminPage>
  );
}
