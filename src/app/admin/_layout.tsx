import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import {
  AdminPage,
  AdminSection,
  Field,
  Loading,
  Status,
  StatusMessage,
} from '../../components/admin/AdminUI';
import { Button } from '../../components/ui';
import { AdminAuthProvider, useAdminAuth } from '../../context/AdminAuthContext';
import { isSupabaseAvailable } from '../../services/supabase';
import { colors, typography } from '../../theme/tokens';

function AdminLogin() {
  const router = useRouter();
  const { signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setStatus({ kind: 'error', message: 'Preencha e-mail e senha.' });
      return;
    }
    setIsSubmitting(true);
    const error = await signIn(email, password);
    setIsSubmitting(false);
    setStatus(error ? { kind: 'error', message: error } : null);
  };

  return (
    <AdminPage
      title="Entrar no painel"
      subtitle="Acesso para a equipe ScanMercado e para os administradores de cada franquia."
      onBack={() => router.replace('/')}
      backLabel="Voltar ao app"
    >
      <AdminSection title="Login">
        {!isSupabaseAvailable ? (
          <StatusMessage
            status={{
              kind: 'error',
              message:
                'Supabase não configurado: preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no .env.',
            }}
          />
        ) : null}
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="voce@mercado.com.br"
        />
        <Field
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          onSubmitEditing={handleSubmit}
        />
        <StatusMessage status={status} />
        <Button label="Entrar" onPress={handleSubmit} loading={isSubmitting} fullWidth />
      </AdminSection>
    </AdminPage>
  );
}

function NoAccess() {
  const { signOut, session } = useAdminAuth();
  return (
    <AdminPage title="Sem acesso ao painel">
      <AdminSection title="Esta conta não é administradora">
        <Text style={{ ...typography.body, color: colors.textMuted }}>
          {session?.user.email} entrou, mas não tem papel de administrador. Peça à equipe
          ScanMercado para liberar o acesso (papel tenant_admin ou platform_admin).
        </Text>
        <Button label="Sair" variant="secondary" onPress={signOut} />
      </AdminSection>
    </AdminPage>
  );
}

function AdminGate() {
  const { isReady, session, profile } = useAdminAuth();

  if (!isReady) return <Loading />;
  if (!session) return <AdminLogin />;
  if (!profile || profile.role === 'customer') return <NoAccess />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function AdminLayout() {
  return (
    <AdminAuthProvider>
      <AdminGate />
    </AdminAuthProvider>
  );
}
