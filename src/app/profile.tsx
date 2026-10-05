import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBudget } from '../context/BudgetContext';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { formatBRL } from '../utils/pricing';

function formatCpfInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

function BudgetSection() {
  const { limit, setLimit } = useBudget();
  const [draft, setDraft] = useState(limit != null ? String(limit) : '');

  const handleSave = () => {
    const parsed = Number(draft.replace(',', '.'));
    if (draft.trim() === '') {
      setLimit(null);
      return;
    }
    if (Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor válido para o orçamento.');
      return;
    }
    setLimit(parsed);
  };

  return (
    <Card style={{ marginTop: spacing.xl }}>
      <Text style={styles.sectionTitle}>Orçamento da compra</Text>
      <Text style={styles.sectionSubtitle}>
        Defina um limite e acompanhe quanto resta enquanto bipa os produtos.
      </Text>
      <View style={styles.budgetRow}>
        <Text style={styles.budgetPrefix}>R$</Text>
        <TextInput
          style={styles.budgetInput}
          placeholder="0,00"
          keyboardType="decimal-pad"
          value={draft}
          onChangeText={setDraft}
        />
        <Button label="Salvar" onPress={handleSave} />
      </View>
      {limit != null ? (
        <Text style={styles.budgetCurrent}>Limite atual: {formatBRL(limit)}</Text>
      ) : null}
    </Card>
  );
}

export default function ProfileScreen() {
  const { user, login, logout } = useAuth();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.xl }}>
        <View style={styles.loggedHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.cpf}>CPF: {user.cpf}</Text>

          <Card style={styles.pointsCard}>
            <Text style={styles.pointsLabel}>Pontos de fidelidade</Text>
            <Text style={styles.pointsValue}>{user.points} pts</Text>
          </Card>
        </View>

        <BudgetSection />

        <Button
          label="Sair da conta"
          variant="danger"
          onPress={logout}
          fullWidth
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    );
  }

  const handleLogin = async () => {
    if (cpf.length !== 11 || password.length === 0) {
      Alert.alert('Preencha os campos', 'Digite o CPF (11 dígitos) e a senha.');
      return;
    }
    setIsSubmitting(true);
    const result = await login(cpf, password);
    setIsSubmitting(false);

    if (result.status === 'invalid_credentials') {
      Alert.alert('Não foi possível entrar', 'CPF ou senha incorretos.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1, justifyContent: 'center' }}>
        <Text style={styles.title}>Entrar</Text>
        <Text style={styles.subtitle}>
          Faça login para acumular pontos e ativar ofertas exclusivas.
        </Text>

        <Text style={styles.label}>CPF</Text>
        <TextInput
          style={styles.input}
          placeholder="Somente números"
          keyboardType="numeric"
          maxLength={11}
          value={cpf}
          onChangeText={(value) => setCpf(formatCpfInput(value))}
          accessibilityLabel="CPF"
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Senha"
        />

        <Button
          label={isSubmitting ? 'Entrando...' : 'Entrar'}
          onPress={handleLogin}
          loading={isSubmitting}
          fullWidth
          style={{ marginTop: spacing.xl }}
        />

        <Text style={styles.demoHint}>Login de teste: CPF 12345678900, senha 123456</Text>

        <BudgetSection />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm },
  label: { ...typography.small, fontWeight: '700', color: colors.textMuted, marginBottom: 6, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    backgroundColor: colors.surface,
  },
  demoHint: { ...typography.small, color: colors.textFaint, textAlign: 'center', marginTop: spacing.lg },
  loggedHeader: { alignItems: 'center' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  name: { ...typography.h2, color: colors.text },
  cpf: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  pointsCard: { marginTop: spacing.xl, alignItems: 'center', alignSelf: 'stretch' },
  pointsLabel: { ...typography.caption, color: colors.textMuted },
  pointsValue: { ...typography.display, color: colors.brand, marginTop: 4 },
  sectionTitle: { ...typography.h2, color: colors.text },
  sectionSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  budgetPrefix: { ...typography.bodyStrong, color: colors.textMuted },
  budgetInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  budgetCurrent: { ...typography.caption, color: colors.brandDark, marginTop: spacing.sm, fontWeight: '600' },
});
