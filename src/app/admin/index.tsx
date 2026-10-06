import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AdminPage, NavCard } from '../../components/admin/AdminUI';
import { Button } from '../../components/ui';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { spacing } from '../../theme/tokens';

/** Início do painel da plataforma (equipe ScanMercado). */
export default function PlatformHome() {
  const router = useRouter();
  const { profile, isPlatformAdmin, signOut } = useAdminAuth();

  // Admin de franquia vai direto para a própria franquia.
  if (!isPlatformAdmin && profile?.tenantId) {
    return <Redirect href={{ pathname: '/admin/[tenantId]', params: { tenantId: profile.tenantId } }} />;
  }

  return (
    <AdminPage
      title="Plataforma"
      subtitle={`Olá, ${profile?.name || profile?.email || 'admin'}`}
      onBack={() => router.replace('/')}
      backLabel="Voltar ao app"
      actions={<Button label="Sair" variant="ghost" onPress={signOut} />}
    >
      <View style={styles.grid}>
        <NavCard
          icon="briefcase"
          title="Franquias"
          description="Criar franquias e entrar em cada uma: produtos, balança, regras e marca."
          onPress={() => router.push('/admin/franquias')}
        />
        <NavCard
          icon="users"
          title="Usuários"
          description="Criar acessos ao painel, definir papel e franquia, redefinir senha e bloquear."
          onPress={() => router.push('/admin/usuarios')}
        />
      </View>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
