import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

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
import { resolveAssetUrl } from '../../../services/api';
import { uploadLogo, removeLogo } from '../../../services/logos';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export default function BrandScreen() {
  const router = useRouter();
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const { isPlatformAdmin } = useAdminAuth();
  const { tenant, error, reload } = useTenant(tenantId);
  const [draft, setDraft] = useState<Tenant | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  async function chooseLogo() {
    setIsUploading(true);
    setStatus(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 1,
        allowsMultipleSelection: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('Não foi possível ler a imagem. Escolha outra.');
      if ((asset.fileSize ?? 0) > 5 * 1024 * 1024)
        throw new Error('Escolha uma imagem de até 5 MB.');
      const saved = await uploadLogo(tenantId, asset.base64);
      update({ logoUrl: saved.logoUrl });
      reload();
      setStatus({
        kind: 'success',
        message: `Logo salva e otimizada: ${Math.max(1, Math.round(saved.optimizedBytes / 1024))} KB. Ela aparecerá na próxima abertura do app.`,
      });
    } catch (err) {
      setStatus({ kind: 'error', message: describeError(err) });
    } finally {
      setIsUploading(false);
    }
  }
  async function clearLogo() {
    setIsUploading(true);
    try {
      await removeLogo(tenantId);
      update({ logoUrl: null });
      reload();
      setStatus({ kind: 'success', message: 'Logo removida. O app usará o nome do mercado.' });
    } catch (err) {
      setStatus({ kind: 'error', message: describeError(err) });
    } finally {
      setIsUploading(false);
    }
  }

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
        error ? (
          <StatusMessage status={{ kind: 'error', message: error }} />
        ) : (
          <Loading />
        )
      ) : (
        <>
          <AdminSection
            title="Marca"
            description="Como a franquia aparece para os clientes. O app aplica a nova marca na próxima vez que for aberto."
          >
            <Field
              label="Nome"
              value={form.name}
              onChangeText={(name) => update({ name })}
              error={nameError}
            />
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
            <View style={styles.logoPreview}>
              {form.logoUrl ? (
                <Image
                  source={{ uri: resolveAssetUrl(form.logoUrl)! }}
                  style={styles.logoImage}
                  resizeMode="contain"
                  accessibilityLabel={`Logo de ${form.name}`}
                />
              ) : (
                <Text style={styles.note}>Sua logo aparecerá aqui</Text>
              )}
            </View>
            <Button
              label={form.logoUrl ? 'Trocar logo' : 'Escolher logo'}
              onPress={() => void chooseLogo()}
              loading={isUploading}
              disabled={isSaving}
              variant="secondary"
            />
            {form.logoUrl ? (
              <Button
                label="Remover logo"
                variant="ghost"
                onPress={() => void clearLogo()}
                disabled={isUploading || isSaving}
              />
            ) : null}
            <Text style={styles.note}>
              PNG, JPG ou WebP, até 5 MB. A logo é salva ao enviar, com compressão automática e
              transparência preservada.
            </Text>
            <Field
              label="Ou usar uma URL externa"
              value={form.logoUrl?.startsWith('/public/tenant-logos/') ? '' : form.logoUrl ?? ''}
              onChangeText={(logoUrl) => update({ logoUrl })}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://..."
              hint="Opcional: use um endereço de imagem já hospedada em vez do upload."
              editable={!isUploading}
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
            {form.isInternal ? (
              <Text style={styles.note}>Franquia interna (piloto), não é cliente pagante.</Text>
            ) : null}
          </AdminSection>

          <StatusMessage status={status} />
          <Button
            label="Salvar"
            onPress={handleSave}
            loading={isSaving}
            disabled={Boolean(colorError || nameError) || isUploading}
          />
        </>
      )}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  logoPreview: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  logoImage: { width: '100%', height: 100 },
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
