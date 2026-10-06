import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { ROLE_OPTIONS } from '../../../components/admin/tenantOptions';
import { Badge, Button } from '../../../components/ui';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { describeError, listTenants, ProfileRole, Tenant } from '../../../services/admin';
import {
  createUser,
  fetchUser,
  ManagedUser,
  resetUserPassword,
  setUserDisabled,
  updateUser,
} from '../../../services/adminUsers';
import { colors, radius, spacing, typography } from '../../../theme/tokens';

const NEW_USER_ID = 'novo';

// Conta nova pelo painel é sempre de acesso ao painel; cliente se cadastra pelo app.
const NEW_USER_ROLES = ROLE_OPTIONS.filter((option) => option.value !== 'customer') as {
  value: 'platform_admin' | 'tenant_admin';
  label: string;
}[];

type Form = { name: string; email: string; role: ProfileRole; tenantId: string | null };

/** Senha temporária mostrada uma única vez — o admin repassa ao usuário. */
function TemporaryPassword({ email, password }: { email: string; password: string }) {
  return (
    <View style={styles.passwordBox}>
      <Text style={styles.passwordTitle}>Senha temporária</Text>
      <Text selectable style={styles.password}>
        {password}
      </Text>
      <Text style={styles.passwordHint}>
        Envie para {email} por um canal seguro. Ela não será mostrada de novo — se perder, use
        &quot;Redefinir senha&quot;.
      </Text>
    </View>
  );
}

export default function UserEditScreen() {
  const router = useRouter();
  const { profile, isPlatformAdmin } = useAdminAuth();
  const { userId: routeUserId, franquia } = useLocalSearchParams<{ userId: string; franquia?: string }>();
  // Depois de criar, a tela continua montada com o id novo — trocar de rota
  // remontaria a tela e perderia a senha temporária, que só aparece uma vez.
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const userId = createdUserId ?? routeUserId;
  const isNew = userId === NEW_USER_ID;
  const isSelf = userId === profile?.id;

  const [user, setUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<Form | null>(
    isNew ? { name: '', email: '', role: 'tenant_admin', tenantId: franquia ?? null } : null,
  );
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [status, setStatus] = useState<Status>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<'reset' | 'block' | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [temporary, setTemporary] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    listTenants()
      .then(setTenants)
      .catch((err) => setStatus({ kind: 'error', message: describeError(err) }));
  }, []);

  useEffect(() => {
    if (isNew) return;
    fetchUser(userId)
      .then((loaded) => {
        setUser(loaded);
        setForm({ name: loaded.name, email: loaded.email ?? '', role: loaded.role, tenantId: loaded.tenantId });
      })
      .catch((err) => setStatus({ kind: 'error', message: describeError(err) }));
  }, [isNew, userId]);

  if (!isPlatformAdmin) return <Redirect href="/admin" />;

  const goBack = () =>
    router.push({ pathname: '/admin/usuarios', params: franquia ? { franquia } : {} });

  const update = (patch: Partial<Form>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setStatus(null);
  };

  const errors: Partial<Record<keyof Form, string>> = {};
  if (form) {
    if (isNew && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'E-mail inválido.';
    if (form.role !== 'platform_admin' && !form.tenantId) errors.tenantId = 'Escolha a franquia.';
  }
  const visibleErrors = showErrors ? errors : {};

  const handleSave = async () => {
    if (!form) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    setIsSaving(true);
    try {
      if (isNew) {
        const result = await createUser({
          email: form.email.trim(),
          name: form.name.trim(),
          role: form.role as 'platform_admin' | 'tenant_admin',
          tenantId: form.role === 'platform_admin' ? null : form.tenantId,
        });
        setTemporary({ email: form.email.trim(), password: result.temporaryPassword });
        setCreatedUserId(result.userId);
        setStatus({ kind: 'success', message: 'Usuário criado. Ele já pode entrar no painel.' });
      } else {
        await updateUser(userId, { name: form.name.trim(), role: form.role, tenantId: form.tenantId });
        setStatus({ kind: 'success', message: 'Usuário atualizado.' });
      }
    } catch (err) {
      setStatus({ kind: 'error', message: describeError(err) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    setBusyAction('reset');
    try {
      const result = await resetUserPassword(user.id);
      setTemporary({ email: user.email ?? '', password: result.temporaryPassword });
      setStatus({ kind: 'success', message: 'Senha redefinida. A anterior deixou de funcionar.' });
    } catch (err) {
      setStatus({ kind: 'error', message: describeError(err) });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleBlock = async () => {
    if (!user) return;
    if (!user.disabled && !confirmBlock) {
      setConfirmBlock(true);
      return;
    }
    setBusyAction('block');
    try {
      await setUserDisabled(user.id, !user.disabled);
      setUser({ ...user, disabled: !user.disabled });
      setConfirmBlock(false);
      setStatus({
        kind: 'success',
        message: user.disabled ? 'Acesso liberado.' : 'Usuário bloqueado — não consegue mais entrar.',
      });
    } catch (err) {
      setStatus({ kind: 'error', message: describeError(err) });
    } finally {
      setBusyAction(null);
    }
  };

  const tenantOptions = tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }));

  return (
    <AdminPage
      title={isNew ? 'Novo usuário' : user?.name || user?.email || 'Usuário'}
      subtitle={!isNew && user?.email ? user.email : undefined}
      onBack={goBack}
      backLabel="Usuários"
      actions={user?.disabled ? <Badge label="Bloqueado" variant="danger" /> : null}
    >
      {temporary ? <TemporaryPassword email={temporary.email} password={temporary.password} /> : null}

      {!form ? (
        status ? <StatusMessage status={status} /> : <Loading />
      ) : (
        <>
          <AdminSection
            title="Acesso"
            description={
              isNew
                ? 'A conta é criada já confirmada, com uma senha temporária gerada no servidor.'
                : undefined
            }
          >
            <FieldRow>
              <Field
                label="E-mail"
                value={form.email}
                onChangeText={(email) => update({ email })}
                editable={isNew}
                autoCapitalize="none"
                keyboardType="email-address"
                error={visibleErrors.email}
                hint={isNew ? undefined : 'O e-mail não pode ser trocado por aqui.'}
              />
              <Field label="Nome" value={form.name} onChangeText={(name) => update({ name })} />
            </FieldRow>
            <Segmented
              label="Papel"
              options={isNew ? NEW_USER_ROLES : ROLE_OPTIONS}
              value={form.role}
              onChange={(role) => update({ role })}
              disabled={isSelf}
              hint={
                isSelf
                  ? 'Você não pode mudar o próprio papel.'
                  : form.role === 'platform_admin'
                    ? 'Acesso total: todas as franquias, usuários e configurações.'
                    : form.role === 'tenant_admin'
                      ? 'Gerencia só a franquia escolhida: produtos, balança, regras e marca.'
                      : 'Cliente do app — não acessa o painel.'
              }
            />
            {form.role !== 'platform_admin' ? (
              tenantOptions.length > 0 ? (
                <Segmented
                  label="Franquia"
                  options={tenantOptions}
                  value={form.tenantId ?? ''}
                  onChange={(tenantId) => update({ tenantId })}
                  disabled={isSelf}
                  hint={visibleErrors.tenantId}
                />
              ) : (
                <Loading />
              )
            ) : null}
            <StatusMessage status={status} />
            <Button
              label={isNew ? 'Criar usuário' : 'Salvar alterações'}
              onPress={handleSave}
              loading={isSaving}
            />
          </AdminSection>

          {!isNew && user ? (
            <AdminSection title="Segurança">
              <View style={styles.actionsRow}>
                <Button
                  label="Redefinir senha"
                  variant="secondary"
                  onPress={handleReset}
                  loading={busyAction === 'reset'}
                />
                {!isSelf ? (
                  <Button
                    label={user.disabled ? 'Desbloquear' : confirmBlock ? 'Confirmar bloqueio' : 'Bloquear acesso'}
                    variant={user.disabled ? 'secondary' : 'danger'}
                    onPress={handleToggleBlock}
                    loading={busyAction === 'block'}
                  />
                ) : null}
                {confirmBlock ? (
                  <Button label="Cancelar" variant="ghost" onPress={() => setConfirmBlock(false)} />
                ) : null}
              </View>
              {confirmBlock ? (
                <Text style={styles.warning}>
                  O usuário perde o acesso na hora. Dá para desbloquear depois.
                </Text>
              ) : null}
            </AdminSection>
          ) : null}
        </>
      )}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  passwordBox: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  passwordTitle: { ...typography.small, color: colors.warning, textTransform: 'uppercase' },
  password: { fontSize: 24, fontWeight: '800', color: colors.text, fontFamily: 'monospace', letterSpacing: 1 },
  passwordHint: { ...typography.caption, color: colors.text },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  warning: { ...typography.caption, color: colors.danger },
});
