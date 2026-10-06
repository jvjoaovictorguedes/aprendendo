import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AdminPage,
  AdminSection,
  Field,
  FieldRow,
  Loading,
  Segmented,
  Status,
  StatusMessage,
} from '../../../components/admin/AdminUI';
import { PLAN_OPTIONS, STATUS_OPTIONS, useTenant } from '../../../components/admin/tenantOptions';
import { Button } from '../../../components/ui';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { describeError, Tenant, updateTenant } from '../../../services/admin';
import { colors, radius, spacing, typography } from '../../../theme/tokens';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export default function BrandScreen() {
  const router = useRouter();
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const { isPlatformAdmin } = useAdminAuth();
  const { tenant, error, reload } = useTenant(tenantId);
  const [draft, setDraft] = useState<Tenant | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Edições locais por cima da franquia carregada.
  const form = draft ?? tenant;

  const update = (patch: Partial<Tenant>) => {
    setDraft((current) => {
      const base = current ?? tenant;
      return base ? { ...base, ...patch } : base;
    });
    setStatus(null);
  };

  const colorError = form && !HEX_COLOR.test(form.accentColor) ? 'Use o formato #RRGGBB.' : null;
  const nameError = form && !form.name.trim() ? 'Informe o nome.' : null;

  const handleSave = async () => {
    if (!form || colorError || nameError) return;
    setIsSaving(true);
    try {
      await updateTenant(tenantId, {
        name: form.name.trim(),
        accentColor: form.accentColor,
        logoUrl: form.logoUrl?.trim() || null,
        // Campos comerciais só vão quando é a plataforma editando (o banco recusa o resto).
        ...(isPlatformAdmin
          ? {
              slug: form.slug.trim(),
              plan: form.plan,
              status: form.status,
              exclusivityRegion: form.exclusivityRegion?.trim() || null,
            }
          : {}),
      });
      reload();
      setStatus({ kind: 'success', message: 'Dados da franquia salvos.' });
    } catch (err) {
      setStatus({ kind: 'error', message: describeError(err) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPage
      title="Marca e dados"
      subtitle={tenant?.name}
      onBack={() => router.push({ pathname: '/admin/[tenantId]', params: { tenantId } })}
      backLabel={tenant?.name ?? 'Franquia'}
    >
      {!form ? (
        error ? <StatusMessage status={{ kind: 'error', message: error }} /> : <Loading />
      ) : (
        <>
          <AdminSection
            title="Marca"
            description="Como a franquia aparece para os clientes. O app aplica a nova marca na próxima vez que for aberto."
          >
            <Field label="Nome" value={form.name} onChangeText={(name) => update({ name })} error={nameError} />
            <View style={styles.colorRow}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Cor principal"
                  value={form.accentColor}
                  onChangeText={(accentColor) => update({ accentColor: accentColor.trim() })}
                  autoCapitalize="none"
                  maxLength={7}
                  error={colorError}
                  hint="Hexadecimal, ex.: #1DB954"
                />
              </View>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: colorError ? colors.surfaceSunken : form.accentColor },
                ]}
              />
            </View>
            <Field
              label="URL do logo"
              value={form.logoUrl ?? ''}
              onChangeText={(logoUrl) => update({ logoUrl })}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://..."
            />
          </AdminSection>

          <AdminSection
            title="Contrato"
            description={
              isPlatformAdmin
                ? 'Dados comerciais — só a equipe ScanMercado pode alterar.'
                : 'Para mudar plano, status ou território, fale com a equipe ScanMercado.'
            }
          >
            <FieldRow>
              <Field
                label="Identificador (slug)"
                value={form.slug}
                onChangeText={(slug) => update({ slug })}
                autoCapitalize="none"
                editable={isPlatformAdmin}
              />
              <Field
                label="Território de exclusividade"
                value={form.exclusivityRegion ?? ''}
                onChangeText={(exclusivityRegion) => update({ exclusivityRegion })}
                editable={isPlatformAdmin}
                placeholder="Ex.: Porto Alegre e região metropolitana"
              />
            </FieldRow>
            <Segmented
              label="Plano"
              options={PLAN_OPTIONS}
              value={form.plan}
              onChange={(plan) => update({ plan })}
              disabled={!isPlatformAdmin}
            />
            <Segmented
              label="Status"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={(status) => update({ status })}
              disabled={!isPlatformAdmin}
            />
            {form.isInternal ? <Text style={styles.note}>Franquia interna (piloto), não é cliente pagante.</Text> : null}
          </AdminSection>

          <StatusMessage status={status} />
          <Button
            label="Salvar"
            onPress={handleSave}
            loading={isSaving}
            disabled={Boolean(colorError || nameError)}
          />
        </>
      )}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  note: { ...typography.caption, color: colors.textMuted },
});
