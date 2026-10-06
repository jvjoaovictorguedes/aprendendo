import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AdminPage,
  AdminSection,
  Field,
  FieldRow,
  Loading,
  parseDecimal,
  Segmented,
  Status,
  StatusMessage,
  ToggleRow,
} from '../../../components/admin/AdminUI';
import { useTenant } from '../../../components/admin/tenantOptions';
import { Button } from '../../../components/ui';
import { AdminProduct, describeError, findProductByPlu } from '../../../services/admin';
import {
  DEFAULT_TENANT_SETTINGS,
  fetchTenantSettings,
  saveTenantSettings,
  TenantSettings,
} from '../../../services/tenantSettings';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { formatBRL, formatKg } from '../../../utils/pricing';
import {
  buildScaleLabel,
  parseScaleLabel,
  resolveScaleLabel,
  ScaleLabelConfig,
  ScaleValueType,
  validateScaleConfig,
} from '../../../utils/scaleLabel';

type Preset = { label: string; config: Omit<ScaleLabelConfig, 'enabled' | 'validateCheckDigit'> };

// Layouts mais comuns das balanças no Brasil (Toledo, Filizola, Urano...).
const PRESETS: Preset[] = [
  {
    label: 'Preço total · PLU 4',
    config: { prefix: '2', pluLength: 4, valueType: 'price', valueLength: 5, valueDecimals: 2 },
  },
  {
    label: 'Preço total · PLU 5',
    config: { prefix: '2', pluLength: 5, valueType: 'price', valueLength: 5, valueDecimals: 2 },
  },
  {
    label: 'Peso · PLU 4',
    config: { prefix: '2', pluLength: 4, valueType: 'weight', valueLength: 5, valueDecimals: 3 },
  },
];

const VALUE_TYPE_OPTIONS: { value: ScaleValueType; label: string }[] = [
  { value: 'price', label: 'Preço total (R$)' },
  { value: 'weight', label: 'Peso (kg)' },
];

type Form = {
  enabled: boolean;
  validateCheckDigit: boolean;
  prefix: string;
  pluLength: string;
  valueType: ScaleValueType;
  valueLength: string;
  valueDecimals: string;
};

function toForm(config: ScaleLabelConfig): Form {
  return {
    enabled: config.enabled,
    validateCheckDigit: config.validateCheckDigit,
    prefix: config.prefix,
    pluLength: String(config.pluLength),
    valueType: config.valueType,
    valueLength: String(config.valueLength),
    valueDecimals: String(config.valueDecimals),
  };
}

function fromForm(form: Form): ScaleLabelConfig {
  return {
    enabled: form.enabled,
    validateCheckDigit: form.validateCheckDigit,
    prefix: form.prefix.trim(),
    pluLength: Number(form.pluLength),
    valueType: form.valueType,
    valueLength: Number(form.valueLength),
    valueDecimals: Number(form.valueDecimals),
  };
}

/** Os 13 dígitos da etiqueta, coloridos por parte. */
function LabelLayout({ config }: { config: ScaleLabelConfig }) {
  const fillerLength = 12 - config.prefix.length - config.pluLength - config.valueLength;
  const parts = [
    { key: 'prefix', label: 'Prefixo', length: config.prefix.length, color: colors.surfaceDark },
    { key: 'plu', label: 'PLU', length: config.pluLength, color: colors.brandDark },
    { key: 'filler', label: 'Livre', length: fillerLength, color: colors.textFaint },
    {
      key: 'value',
      label: config.valueType === 'price' ? 'Preço' : 'Peso',
      length: config.valueLength,
      color: colors.warning,
    },
    { key: 'check', label: 'DV', length: 1, color: colors.danger },
  ].filter((part) => part.length > 0);

  return (
    <View style={styles.layoutRow}>
      {parts.map((part) => (
        <View key={part.key} style={{ flex: part.length, minWidth: 34 }}>
          <View style={[styles.layoutBar, { backgroundColor: part.color }]}>
            <Text style={styles.layoutDigits}>{part.length}</Text>
          </View>
          <Text style={styles.layoutLabel}>{part.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Simulator({ tenantId, config }: { tenantId: string; config: ScaleLabelConfig }) {
  const [plu, setPlu] = useState('1001');
  const [value, setValue] = useState(config.valueType === 'price' ? '12,50' : '1,250');
  const [code, setCode] = useState('');
  const [product, setProduct] = useState<AdminProduct | null | undefined>(undefined);

  const generated = useMemo(() => {
    const parsedValue = parseDecimal(value);
    return Number.isNaN(parsedValue) ? null : buildScaleLabel(plu, parsedValue, config);
  }, [plu, value, config]);

  const codeToRead = code.trim() || generated || '';
  const label = useMemo(() => parseScaleLabel(codeToRead, config), [codeToRead, config]);

  useEffect(() => {
    if (!label) return;
    let cancelled = false;
    findProductByPlu(tenantId, label.plu)
      .catch(() => null)
      .then((result) => {
        if (!cancelled) setProduct(result);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, label]);

  const resolved = label && product ? resolveScaleLabel(label, product) : null;

  return (
    <AdminSection
      title="Simulador"
      description="Gere uma etiqueta de teste ou cole o código impresso pela balança para ver como o app vai ler."
    >
      <FieldRow>
        <Field label="PLU" value={plu} onChangeText={setPlu} keyboardType="number-pad" />
        <Field
          label={config.valueType === 'price' ? 'Preço total (R$)' : 'Peso (kg)'}
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
        />
      </FieldRow>
      <Text style={styles.generated}>
        Etiqueta gerada: <Text style={styles.code}>{generated ?? '— não cabe no layout'}</Text>
      </Text>
      <Field
        label="Ou cole um código lido da balança"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        placeholder="13 dígitos"
        maxLength={13}
      />

      <View style={styles.result}>
        {!codeToRead ? null : !label ? (
          <Text style={styles.resultError}>
            Este código não é reconhecido como etiqueta de balança com a configuração atual — o app
            vai tratá-lo como código de barras comum.
          </Text>
        ) : (
          <>
            <Text style={styles.resultLine}>
              PLU <Text style={styles.code}>{label.plu}</Text> ·{' '}
              {label.valueType === 'price' ? formatBRL(label.value) : formatKg(label.value)}
            </Text>
            {product === undefined ? null : product ? (
              <Text style={styles.resultLine}>
                {product.name} ({formatBRL(product.price)}/{product.unit}) →{' '}
                {resolved ? `${formatKg(resolved.weightKg, resolved.weightIsEstimated)} · ${formatBRL(resolved.total)}` : ''}
              </Text>
            ) : (
              <Text style={styles.resultError}>
                Nenhum produto com PLU {label.plu} nesta franquia. Cadastre em Produtos.
              </Text>
            )}
          </>
        )}
      </View>
    </AdminSection>
  );
}

export default function ScaleSettingsScreen() {
  const router = useRouter();
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const { tenant } = useTenant(tenantId);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTenantSettings(tenantId)
      .then((result) => {
        const loaded = result ?? DEFAULT_TENANT_SETTINGS;
        setSettings(loaded);
        setForm(toForm(loaded.scale));
      })
      .catch((err) => setStatus({ kind: 'error', message: describeError(err) }));
  }, [tenantId]);

  const config = form ? fromForm(form) : null;
  const layoutError = config ? validateScaleConfig(config) : null;

  const update = (patch: Partial<Form>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setStatus(null);
  };

  const applyPreset = (preset: Preset) => {
    update({
      prefix: preset.config.prefix,
      pluLength: String(preset.config.pluLength),
      valueType: preset.config.valueType,
      valueLength: String(preset.config.valueLength),
      valueDecimals: String(preset.config.valueDecimals),
    });
  };

  const handleSave = async () => {
    if (!settings || !config || layoutError) return;
    setIsSaving(true);
    try {
      const next = { ...settings, scale: config };
      await saveTenantSettings(tenantId, next);
      setSettings(next);
      setStatus({ kind: 'success', message: 'Configuração da balança salva. O app passa a usar na próxima abertura.' });
    } catch (err) {
      setStatus({ kind: 'error', message: describeError(err) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPage
      title="Balança"
      subtitle={tenant ? `Etiqueta de peso variável · ${tenant.name}` : undefined}
      onBack={() => router.push({ pathname: '/admin/[tenantId]', params: { tenantId } })}
      backLabel={tenant?.name ?? 'Franquia'}
    >
      {!form || !config ? (
        status ? <StatusMessage status={status} /> : <Loading />
      ) : (
        <>
          <AdminSection
            title="Como funciona"
            description="O cliente pesa o produto e a balança imprime um código com o PLU e o valor embutidos. Cada produto é cadastrado uma vez só (PLU + preço do kg) — qualquer peso funciona."
          >
            <ToggleRow
              label="Ler etiquetas de balança"
              description="Desligado, todo código é tratado como código de barras comum."
              value={form.enabled}
              onChange={(enabled) => update({ enabled })}
            />
          </AdminSection>

          <AdminSection
            title="Formato da etiqueta"
            description="Configure igual ao que está programado na balança da loja. Use um modelo pronto ou ajuste cada parte."
          >
            <View style={styles.presets}>
              {PRESETS.map((preset) => (
                <Button key={preset.label} label={preset.label} variant="secondary" onPress={() => applyPreset(preset)} />
              ))}
            </View>

            {!layoutError ? <LabelLayout config={config} /> : null}

            <Segmented
              label="O código traz"
              options={VALUE_TYPE_OPTIONS}
              value={form.valueType}
              onChange={(valueType) =>
                update({ valueType, valueDecimals: valueType === 'price' ? '2' : '3' })
              }
              hint={
                form.valueType === 'price'
                  ? 'Recomendado: o valor que o cliente vê é exatamente o que o caixa cobra.'
                  : 'O app calcula peso × preço do kg cadastrado.'
              }
            />
            <FieldRow>
              <Field
                label="Prefixo"
                value={form.prefix}
                onChangeText={(prefix) => update({ prefix: prefix.replace(/\D/g, '') })}
                keyboardType="number-pad"
                maxLength={2}
                hint="Normalmente 2"
              />
              <Field
                label="Dígitos do PLU"
                value={form.pluLength}
                onChangeText={(pluLength) => update({ pluLength: pluLength.replace(/\D/g, '') })}
                keyboardType="number-pad"
                maxLength={1}
                hint="De 1 a 6"
              />
              <Field
                label="Dígitos do valor"
                value={form.valueLength}
                onChangeText={(valueLength) => update({ valueLength: valueLength.replace(/\D/g, '') })}
                keyboardType="number-pad"
                maxLength={1}
                hint="De 4 a 6"
              />
              <Field
                label="Casas decimais"
                value={form.valueDecimals}
                onChangeText={(valueDecimals) => update({ valueDecimals: valueDecimals.replace(/\D/g, '') })}
                keyboardType="number-pad"
                maxLength={1}
                hint={form.valueType === 'price' ? '2 = centavos' : '3 = gramas'}
              />
            </FieldRow>
            <ToggleRow
              label="Conferir dígito verificador"
              description="Recusa etiquetas lidas com erro. Só desligue se a balança não calcular o dígito."
              value={form.validateCheckDigit}
              onChange={(validateCheckDigit) => update({ validateCheckDigit })}
            />
            <StatusMessage status={layoutError ? { kind: 'error', message: layoutError } : status} />
            <Button
              label="Salvar configuração"
              onPress={handleSave}
              loading={isSaving}
              disabled={Boolean(layoutError)}
            />
          </AdminSection>

          {!layoutError ? <Simulator tenantId={tenantId} config={config} /> : null}

        </>
      )}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  layoutRow: { flexDirection: 'row', gap: 4 },
  layoutBar: {
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutDigits: { color: '#fff', fontWeight: '700', fontSize: 13 },
  layoutLabel: { ...typography.small, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  generated: { ...typography.body, color: colors.textMuted },
  code: { fontFamily: 'monospace', color: colors.text, fontWeight: '700' },
  result: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  resultLine: { ...typography.body, color: colors.text },
  resultError: { ...typography.caption, color: colors.danger },
});
