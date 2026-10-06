import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  AdminPage,
  AdminSection,
  Field,
  FieldRow,
  Loading,
  Segmented,
  Status,
  StatusMessage,
} from '../../components/admin/AdminUI';
import { Badge, Button } from '../../components/ui';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { optionLabel, PLAN_OPTIONS, STATUS_OPTIONS } from '../../components/admin/tenantOptions';
import { createTenant, describeError, listTenants, Tenant, TenantPlan } from '../../services/admin';
import { colors, radius, spacing, typography } from '../../theme/tokens';

function NewTenantForm({ onCreated }: { onCreated: (tenant: Tenant) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState<TenantPlan>('padrao');
  const [status, setStatus] = useState<Status>(null);
  const [isSaving, setIsSaving] = useState(false);

  const suggestedSlug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const handleCreate = async () => {
    const finalSlug = slug.trim() || suggestedSlug;
    if (!name.trim() || !finalSlug) {
      setStatus({ kind: 'error', message: 'Informe o nome da franquia.' });
      return;
    }
    setIsSaving(true);
    try {
      const tenant = await createTenant({ name: name.trim(), slug: finalSlug, plan, accentColor: colors.brand });
      onCreated(tenant);
    } catch (err) {
      setStatus({ kind: 'error', message: describeError(err) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminSection title="Nova franquia" description="Ela já nasce com a configuração padrão de balança e regras.">
      <FieldRow>
        <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Mercado Bom Preço" />
        <Field
          label="Identificador (slug)"
          value={slug}
          onChangeText={setSlug}
          placeholder={suggestedSlug || 'mercado-bom-preco'}
          autoCapitalize="none"
          hint="Usado na URL da franquia. Deixe vazio para usar a sugestão."
        />
      </FieldRow>
      <Segmented label="Plano" options={PLAN_OPTIONS} value={plan} onChange={setPlan} />
      <StatusMessage status={status} />
      <Button label="Criar franquia" onPress={handleCreate} loading={isSaving} />
    </AdminSection>
  );
}

export default function AdminHome() {
  const router = useRouter();
  const { profile, isPlatformAdmin, signOut } = useAdminAuth();
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const load = useCallback(() => {
    listTenants()
      .then(setTenants)
      .catch((err) => setStatus({ kind: 'error', message: describeError(err) }));
  }, []);

  useEffect(() => {
    if (isPlatformAdmin) load();
  }, [isPlatformAdmin, load]);

  // Admin de franquia vai direto para a própria franquia.
  if (!isPlatformAdmin && profile?.tenantId) {
    return <Redirect href={{ pathname: '/admin/[tenantId]', params: { tenantId: profile.tenantId } }} />;
  }

  const openTenant = (tenantId: string) =>
    router.push({ pathname: '/admin/[tenantId]', params: { tenantId } });

  return (
    <AdminPage
      title="Franquias"
      subtitle={profile?.name ? `Olá, ${profile.name}` : 'Painel da plataforma'}
      onBack={() => router.replace('/')}
      backLabel="Voltar ao app"
      actions={
        <>
          <Button
            label={showNewForm ? 'Cancelar' : 'Nova franquia'}
            variant={showNewForm ? 'secondary' : 'primary'}
            onPress={() => setShowNewForm((value) => !value)}
          />
          <Button label="Sair" variant="ghost" onPress={signOut} />
        </>
      }
    >
      {showNewForm ? (
        <NewTenantForm
          onCreated={(tenant) => {
            setShowNewForm(false);
            openTenant(tenant.id);
          }}
        />
      ) : null}

      <StatusMessage status={status} />

      {tenants === null && !status ? <Loading /> : null}

      <View style={styles.grid}>
        {(tenants ?? []).map((tenant) => (
          <TouchableOpacity key={tenant.id} style={styles.card} onPress={() => openTenant(tenant.id)}>
            <View style={[styles.swatch, { backgroundColor: tenant.accentColor }]} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name}>{tenant.name}</Text>
              <Text style={styles.meta}>
                {tenant.slug} · {optionLabel(PLAN_OPTIONS, tenant.plan)}
              </Text>
              {tenant.exclusivityRegion ? <Text style={styles.meta}>{tenant.exclusivityRegion}</Text> : null}
            </View>
            <Badge
              label={optionLabel(STATUS_OPTIONS, tenant.status)}
              variant={tenant.status === 'ativa' ? 'brand' : tenant.status === 'suspensa' ? 'danger' : 'neutral'}
            />
          </TouchableOpacity>
        ))}
      </View>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  swatch: { width: 36, height: 36, borderRadius: radius.md },
  name: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
});
