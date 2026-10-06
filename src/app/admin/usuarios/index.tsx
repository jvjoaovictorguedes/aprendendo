import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AdminPage, Field, Loading, StatusMessage, ToggleRow } from '../../../components/admin/AdminUI';
import { optionLabel, ROLE_OPTIONS, useTenant } from '../../../components/admin/tenantOptions';
import { Badge, Button } from '../../../components/ui';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { describeError } from '../../../services/admin';
import { listUsers, ManagedUser } from '../../../services/adminUsers';
import { colors, radius, spacing, typography } from '../../../theme/tokens';

const SEARCH_DEBOUNCE_MS = 300;

export default function UsersScreen() {
  const router = useRouter();
  const { isPlatformAdmin } = useAdminAuth();
  // ?franquia=<id> filtra por franquia (link vindo da tela da franquia).
  const { franquia } = useLocalSearchParams<{ franquia?: string }>();
  const { tenant: filterTenant } = useTenant(franquia);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [includeCustomers, setIncludeCustomers] = useState(false);
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  // Recarrega ao voltar da tela de edição.
  useFocusEffect(
    useCallback(() => {
      if (!isPlatformAdmin) return;
      let cancelled = false;
      listUsers({ search: debouncedSearch, tenantId: franquia, includeCustomers })
        .then((result) => {
          if (cancelled) return;
          setUsers(result);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(describeError(err));
        });
      return () => {
        cancelled = true;
      };
    }, [isPlatformAdmin, debouncedSearch, franquia, includeCustomers]),
  );

  if (!isPlatformAdmin) return <Redirect href="/admin" />;

  const openUser = (userId: string) =>
    router.push({
      pathname: '/admin/usuarios/[userId]',
      params: franquia ? { userId, franquia } : { userId },
    });

  return (
    <AdminPage
      title="Usuários"
      subtitle={filterTenant ? `Franquia: ${filterTenant.name}` : 'Quem acessa o painel admin.'}
      onBack={() =>
        franquia
          ? router.push({ pathname: '/admin/[tenantId]', params: { tenantId: franquia } })
          : router.push('/admin')
      }
      backLabel={filterTenant?.name ?? 'Plataforma'}
      actions={<Button label="Novo usuário" onPress={() => openUser('novo')} />}
    >
      <Field
        label="Buscar"
        value={search}
        onChangeText={setSearch}
        placeholder="Nome ou e-mail"
        autoCapitalize="none"
      />
      <ToggleRow
        label="Mostrar clientes do app"
        description="Por padrão a lista mostra só quem acessa o painel."
        value={includeCustomers}
        onChange={setIncludeCustomers}
      />
      {franquia ? (
        <TouchableOpacity onPress={() => router.setParams({ franquia: undefined })}>
          <Text style={styles.clearFilter}>Ver usuários de todas as franquias</Text>
        </TouchableOpacity>
      ) : null}

      <StatusMessage status={error ? { kind: 'error', message: error } : null} />
      {users === null && !error ? <Loading /> : null}
      {users?.length === 0 ? <Text style={styles.empty}>Nenhum usuário encontrado.</Text> : null}

      <View style={styles.list}>
        {(users ?? []).map((user) => (
          <TouchableOpacity key={user.id} style={styles.row} onPress={() => openUser(user.id)}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.name, user.disabled && styles.disabled]}>{user.name || user.email}</Text>
              <Text style={styles.meta}>
                {[user.name ? user.email : null, user.tenantName].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge
                label={optionLabel(ROLE_OPTIONS, user.role)}
                variant={user.role === 'platform_admin' ? 'warning' : user.role === 'tenant_admin' ? 'brand' : 'neutral'}
              />
              {user.disabled ? <Badge label="Bloqueado" variant="danger" /> : null}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { ...typography.bodyStrong, color: colors.text },
  disabled: { color: colors.textFaint, textDecorationLine: 'line-through' },
  meta: { ...typography.caption, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  clearFilter: { ...typography.caption, color: colors.brandDark, fontWeight: '600' },
});
