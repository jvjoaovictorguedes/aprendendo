import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button, Card, Icon } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useBudget } from '../context/BudgetContext';
import { useFavorites } from '../context/FavoritesContext';
import { useHistory } from '../context/HistoryContext';
import { useNotifications } from '../context/NotificationsContext';
import { findProductByBarcode } from '../data/products';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { getTierProgress } from '../utils/loyalty';
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
    <Card style={{ marginTop: spacing.lg }}>
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

function MenuRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress}>
      <Icon name={icon} size={19} color={danger ? colors.danger : colors.textMuted} />
      <Text style={[styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
      {!danger ? <Icon name="chevron-right" size={17} color={colors.textFaint} /> : null}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, login, logout } = useAuth();
  const { favoriteBarcodes, toggleFavorite } = useFavorites();
  const { purchases } = useHistory();
  const { pushEnabled, setPushEnabled } = useNotifications();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    const tierProgress = getTierProgress(user.points);
    const favoriteProducts = favoriteBarcodes
      .map((barcode) => findProductByBarcode(barcode))
      .filter((product): product is NonNullable<typeof product> => Boolean(product));
    const recentPurchases = purchases.slice(0, 2);

    const handleTogglePush = async (value: boolean) => {
      const granted = await setPushEnabled(value);
      if (value && !granted) {
        Alert.alert(
          'Permissão necessária',
          'Para receber notificações, permita o acesso nas configurações do celular.',
        );
      }
    };

    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={styles.loggedHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.cpf}>CPF: {user.cpf}</Text>
        </View>

        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyTop}>
            <View>
              <Text style={styles.loyaltyCardLabel}>Cartão ScanMercado</Text>
              <Text style={styles.loyaltyCardName}>{user.name}</Text>
            </View>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>Nível {tierProgress.tier}</Text>
            </View>
          </View>
          <View style={styles.loyaltyBottom}>
            <View>
              <Text style={styles.loyaltyCardLabel}>Pontos de fidelidade</Text>
              <Text style={styles.loyaltyPointsValue}>{user.points} pts</Text>
            </View>
            <Icon name="credit-card" size={26} color="rgba(255,255,255,0.5)" />
          </View>
        </View>

        <Card style={{ marginTop: spacing.lg }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Favoritos</Text>
          </View>
          {favoriteProducts.length === 0 ? (
            <Text style={styles.emptyHint}>
              Toque no coração de um produto no carrinho para favoritá-lo.
            </Text>
          ) : (
            favoriteProducts.map((product) => (
              <View key={product.barcode} style={styles.favoriteRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.favoriteName}>{product.name}</Text>
                  <Text style={styles.favoritePrice}>{formatBRL(product.price)}</Text>
                </View>
                <TouchableOpacity onPress={() => toggleFavorite(product.barcode)} hitSlop={8}>
                  <Icon name="heart" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Compras recentes</Text>
            <TouchableOpacity onPress={() => router.push('/historico')}>
              <Text style={styles.sectionAction}>Ver tudo</Text>
            </TouchableOpacity>
          </View>
          {recentPurchases.length === 0 ? (
            <Text style={styles.emptyHint}>Suas compras finalizadas aparecem aqui.</Text>
          ) : (
            recentPurchases.map((purchase) => (
              <TouchableOpacity
                key={purchase.id}
                style={styles.purchaseRow}
                onPress={() => router.push('/historico')}
              >
                <View>
                  <Text style={styles.favoriteName}>
                    {new Date(purchase.date).toLocaleDateString('pt-BR')}
                  </Text>
                  <Text style={styles.favoritePrice}>{purchase.items.length} produto(s)</Text>
                </View>
                <Text style={styles.purchaseTotal}>{formatBRL(purchase.finalTotal)}</Text>
              </TouchableOpacity>
            ))
          )}
        </Card>

        <BudgetSection />

        <Card style={{ marginTop: spacing.lg, padding: 0 }}>
          <MenuRow icon="map-pin" label="Lojas próximas" onPress={() => router.push('/lojas')} />
          <View style={styles.menuDivider} />
          <View style={styles.menuRow}>
            <Icon name="bell" size={19} color={colors.textMuted} />
            <Text style={styles.menuLabel}>Notificações</Text>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              trackColor={{ true: colors.brand, false: colors.border }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.menuDivider} />
          <MenuRow
            icon="help-circle"
            label="Ajuda e suporte"
            onPress={() =>
              Alert.alert('Ajuda e suporte', 'Fale com a gente pelo e-mail contato@scanmercado.com.br')
            }
          />
        </Card>

        <Card style={{ marginTop: spacing.lg, padding: 0 }}>
          <MenuRow icon="log-out" label="Sair da conta" onPress={logout} danger />
        </Card>
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  name: { ...typography.h2, color: colors.text },
  cpf: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  loyaltyCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  loyaltyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  loyaltyCardLabel: { color: colors.textFaint, ...typography.small },
  loyaltyCardName: { color: colors.onBrand, ...typography.bodyStrong, marginTop: 2 },
  tierBadge: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  tierBadgeText: { color: colors.onBrand, ...typography.small, fontWeight: '700' },
  loyaltyBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  loyaltyPointsValue: { color: colors.brand, fontSize: 26, fontWeight: '800', marginTop: 2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h2, color: colors.text },
  sectionAction: { ...typography.caption, color: colors.brand, fontWeight: '700' },
  sectionSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  emptyHint: { ...typography.body, color: colors.textMuted },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  favoriteName: { ...typography.bodyStrong, color: colors.text },
  favoritePrice: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  purchaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  purchaseTotal: { ...typography.bodyStrong, color: colors.text },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuLabel: { flex: 1, ...typography.body, fontWeight: '600', color: colors.text },
  menuDivider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg },
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
