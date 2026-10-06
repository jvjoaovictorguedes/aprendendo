import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

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
import { isApiAvailable } from '../../services/api';

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
        {!isApiAvailable ? (
          <StatusMessage
            status={{ kind: 'error', message: 'API não configurada: preencha EXPO_PUBLIC_API_URL no .env.' }}
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

/** Primeiro acesso com senha temporária: troca obrigatória antes de usar o painel. */
function ChangePassword() {
  const { profile, changePassword, signOut } = useAdminAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const handleSubmit = async () => {
    if (next.length < 8) {
      setStatus({ kind: 'error', message: 'A nova senha precisa ter pelo menos 8 caracteres.' });
      return;
    }
    if (next !== confirmation) {
      setStatus({ kind: 'error', message: 'A confirmação não bate com a nova senha.' });
      return;
    }
    setIsSubmitting(true);
    const error = await changePassword(current, next);
    setIsSubmitting(false);
    if (error) setStatus({ kind: 'error', message: error });
  };

  return (
    <AdminPage
      title="Crie sua senha"
      subtitle={`${profile?.email ?? ''} — você entrou com uma senha temporária. Defina a sua para continuar.`}
      actions={<Button label="Sair" variant="ghost" onPress={signOut} />}
    >
      <AdminSection title="Nova senha">
        <Field label="Senha temporária" value={current} onChangeText={setCurrent} secureTextEntry />
        <Field
          label="Nova senha"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres."
        />
        <Field
          label="Confirme a nova senha"
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          autoComplete="new-password"
          onSubmitEditing={handleSubmit}
        />
        <StatusMessage status={status} />
        <Button label="Salvar senha" onPress={handleSubmit} loading={isSubmitting} fullWidth />
      </AdminSection>
    </AdminPage>
  );
}

function AdminGate() {
  const { isReady, profile } = useAdminAuth();

  if (!isReady) return <Loading />;
  if (!profile) return <AdminLogin />;
  if (profile.mustChangePassword) return <ChangePassword />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function AdminLayout() {
  return (
    <AdminAuthProvider>
      <AdminGate />
    </AdminAuthProvider>
  );
}
