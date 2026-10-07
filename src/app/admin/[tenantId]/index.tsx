import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AdminPage, Loading, NavCard, StatusMessage } from '../../../components/admin/AdminUI';
import {
  optionLabel,
  PLAN_OPTIONS,
  STATUS_OPTIONS,
  useTenant,
} from '../../../components/admin/tenantOptions';
import { Button } from '../../../components/ui';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { spacing } from '../../../theme/tokens';

export default function TenantHome() {
  const router = useRouter();
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const { isPlatformAdmin, signOut } = useAdminAuth();
  const { tenant, error } = useTenant(tenantId);

  const go = (
    pathname:
      | '/admin/[tenantId]/marca'
      | '/admin/[tenantId]/balanca'
      | '/admin/[tenantId]/regras'
      | '/admin/[tenantId]/produtos'
      | '/admin/[tenantId]/promocoes'
      | '/admin/[tenantId]/lojas'
      | '/admin/[tenantId]/fidelidade',
  ) => router.push({ pathname, params: { tenantId } });

  return (
    <AdminPage
      title={tenant?.name ?? 'Franquia'}
      subtitle={
        tenant
          ? `${optionLabel(PLAN_OPTIONS, tenant.plan)} · ${optionLabel(STATUS_OPTIONS, tenant.status)}`
          : undefined
      }
      onBack={isPlatformAdmin ? () => router.push('/admin/franquias') : () => router.replace('/')}
      backLabel={isPlatformAdmin ? 'Franquias' : 'Voltar ao app'}
      actions={isPlatformAdmin ? null : <Button label="Sair" variant="ghost" onPress={signOut} />}
    >
      <StatusMessage status={error ? { kind: 'error', message: error } : null} />
      {!tenant && !error ? <Loading /> : null}

      {tenant ? (
        <View style={styles.grid}>
          <NavCard
            icon="percent"
            title="Promoções e cupons"
            description="Crie ofertas gerais e do clube, validade, limites e condições por loja."
            onPress={() => go('/admin/[tenantId]/promocoes')}
          />
          <NavCard
            icon="map-pin"
            title="Lojas"
            description="Cadastre as lojas participantes e seus horários."
            onPress={() => go('/admin/[tenantId]/lojas')}
          />
          <NavCard
            icon="star"
            title="Fidelidade"
            description="Configure benefícios por pontos e confirme resgates."
            onPress={() => go('/admin/[tenantId]/fidelidade')}
          />
          <NavCard
            icon="shopping-bag"
            title="Produtos"
            description="Catálogo, preços, preço do kg e código PLU da balança."
            onPress={() => go('/admin/[tenantId]/produtos')}
          />
          <NavCard
            icon="sliders"
            title="Balança"
            description="Formato da etiqueta: prefixo, PLU, preço ou peso, com simulador."
            onPress={() => go('/admin/[tenantId]/balanca')}
          />
          <NavCard
            icon="settings"
            title="Regras do app"
            description="Aviso de orçamento e intervalo entre bipagens."
            onPress={() => go('/admin/[tenantId]/regras')}
          />
          <NavCard
            icon="droplet"
            title="Marca e dados"
            description={
              isPlatformAdmin
                ? 'Nome, cor, logo, plano, status e território.'
                : 'Nome, cor e logo da franquia.'
            }
            onPress={() => go('/admin/[tenantId]/marca')}
          />
          {isPlatformAdmin ? (
            <NavCard
              icon="users"
              title="Usuários"
              description="Quem administra esta franquia no painel."
              onPress={() =>
                router.push({
                  pathname: '/admin/usuarios',
                  params: { franquia: tenantId },
                })
              }
            />
          ) : null}
        </View>
      ) : null}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
