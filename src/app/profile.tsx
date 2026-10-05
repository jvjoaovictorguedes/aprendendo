import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';

function formatCpfInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

export default function ProfileScreen() {
  const { user, login, logout } = useAuth();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return (
      <View style={styles.loggedContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.cpf}>CPF: {user.cpf}</Text>

        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Pontos de fidelidade</Text>
          <Text style={styles.pointsValue}>{user.points} pts</Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
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
      />

      <Text style={styles.label}>Senha</Text>
      <TextInput
        style={styles.input}
        placeholder="••••••"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={[styles.loginButton, isSubmitting && { opacity: 0.6 }]}
        onPress={handleLogin}
        disabled={isSubmitting}
      >
        <Text style={styles.loginButtonText}>{isSubmitting ? 'Entrando...' : 'Entrar'}</Text>
      </TouchableOpacity>

      <Text style={styles.demoHint}>
        Login de teste: CPF 12345678900, senha 123456
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#777', marginTop: 6, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  loginButton: {
    backgroundColor: '#1DB954',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  loginButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  demoHint: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 16 },
  loggedContainer: { flex: 1, backgroundColor: '#fff', alignItems: 'center', padding: 24, paddingTop: 48 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 19, fontWeight: '700', color: '#1A1A1A' },
  cpf: { fontSize: 13, color: '#777', marginTop: 4 },
  pointsCard: {
    marginTop: 24,
    backgroundColor: '#F3F3F3',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  pointsLabel: { fontSize: 13, color: '#777' },
  pointsValue: { fontSize: 28, fontWeight: '800', color: '#1DB954', marginTop: 4 },
  logoutButton: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#C0392B',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  logoutButtonText: { color: '#C0392B', fontWeight: '700' },
});
