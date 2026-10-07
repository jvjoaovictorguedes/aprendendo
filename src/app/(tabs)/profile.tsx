import { useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  Icon,
  ListRow,
  Notice,
  Screen,
  ScreenHeader,
  TextField,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useBudget } from '../../context/BudgetContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useHistory } from '../../context/HistoryContext';
import { useNotifications } from '../../context/NotificationsContext';
import { isApiConfigured } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { usePromotions } from '../../context/PromotionsContext';
import { findProductByBarcode } from '../../data/products';
import { brand, colors, radius, spacing, typography } from '../../theme/tokens';
import { LoyaltyCard } from '../../components/LoyaltyCard';
import { getTierProgress } from '../../utils/loyalty';
import { formatBRL, parseDecimal } from '../../utils/pricing';
import { showMessage } from '../../utils/dialogs';
import { useDemo } from '../../context/DemoContext';

function formatCpfInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

function BudgetSection() {
  const { limit, setLimit } = useBudget();
  const [draft, setDraft] = useState(limit != null ? limit.toFixed(2).replace('.', ',') : '');
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (draft.trim() === '') {
      setLimit(null);
      setError(null);
      return;
    }
    const parsed = parseDecimal(draft);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setError('Digite um valor maior que zero, por exemplo 250,00.');
      return;
    }
    setError(null);
    setLimit(parsed);
  };

  return (
    <Card style={styles.stack}>
      <View>
        <Text style={styles.cardTitle}>Orçamento da compra</Text>
        <Text style={styles.cardSubtitle}>
          Defina um limite e veja quanto resta enquanto bipa os produtos.
        </Text>
      </View>
      <View style={styles.inlineForm}>
        <TextField
          prefix="R$"
          placeholder="0,00"
          keyboardType="decimal-pad"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleSave}
          accessibilityLabel="Limite do orçamento"
        />
        <Button label="Salvar" onPress={handleSave} />
      </View>
      {error ? <Notice tone="error" message={error} /> : null}
      {limit != null ? (
        <Text style={styles.budgetCurrent}>
          Limite atual: {formatBRL(limit)} · deixe em branco para remover
        </Text>
      ) : null}
    </Card>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, login, register, logout } = useAuth();
  const demo = useDemo();
  const { favoriteBarcodes, toggleFavorite } = useFavorites();
  const { purchases } = useHistory();
  const { pushEnabled, setPushEnabled, preferences, updatePreference, pushError, busy } =
    useNotifications();
  const { items } = useCart();
  const { offers } = usePromotions();
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    const tierProgress = getTierProgress(user.points);
    const favoriteProducts = favoriteBarcodes
      .map((barcode) =>
        isApiConfigured
          ? (items.find((i) => i.product.barcode === barcode)?.product ??
            offers.find((o) => o.product.barcode === barcode)?.product)
          : findProductByBarcode(barcode),
      )
      .filter((product): product is NonNullable<typeof product> => Boolean(product));
    const recentPurchases = purchases.slice(0, 3);

    return (
      <Screen header={<ScreenHeader title="Conta" />}>
        <View style={styles.memberCard}>
          <View style={styles.memberTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.memberName}>{user.name}</Text>
              <Text style={styles.memberMeta}>CPF {user.cpf}</Text>
            </View>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>Nível {tierProgress.tier}</Text>
            </View>
          </View>
          <View style={styles.memberBottom}>
            <Text style={styles.memberMeta}>Cartão {brand.name}</Text>
            <Icon name="credit-card" size={22} color={colors.textFaint} />
          </View>
        </View>

        <LoyaltyCard />

        <Card padded={false}>
          <View style={styles.cardHeaderPad}>
            <SectionTitle title="Favoritos" />
          </View>
          {favoriteProducts.length === 0 ? (
            <Text style={[styles.emptyHint, styles.cardBodyPad]}>
              Toque no coração de um produto no carrinho para favoritá-lo.
            </Text>
          ) : (
            favoriteProducts.map((product) => (
              <ListRow
                key={product.barcode}
                title={product.name}
                subtitle={formatBRL(product.price)}
                divider
                right={
                  <Button
                    label="Remover"
                    variant="ghost"
                    onPress={() => toggleFavorite(product.barcode)}
                  />
                }
              />
            ))
          )}
        </Card>

        <Card padded={false}>
          <View style={styles.cardHeaderPad}>
            <SectionTitle
              title="Compras recentes"
              action={
                <Button label="Ver tudo" variant="ghost" onPress={() => router.push('/historico')} />
              }
            />
          </View>
          {recentPurchases.length === 0 ? (
            <Text style={[styles.emptyHint, styles.cardBodyPad]}>
              Suas compras salvas aparecem aqui.
            </Text>
          ) : (
            recentPurchases.map((purchase) => (
              <ListRow
                key={purchase.id}
                icon="shopping-bag"
                title={new Date(purchase.date).toLocaleDateString('pt-BR')}
                subtitle={`${purchase.items.length} produto(s)`}
                divider
                onPress={() => router.push('/historico')}
                right={<Text style={styles.amount}>{formatBRL(purchase.finalTotal)}</Text>}
              />
            ))
          )}
        </Card>

        <BudgetSection />

        <Card padded={false}>
          <View style={styles.cardHeaderPad}>
            <SectionTitle title="Notificações" />
          </View>
          <ListRow
            icon="bell"
            title="Receber neste celular"
            subtitle="Até um aviso por dia, das 8h às 22h."
            divider
            right={
              <Switch
                accessibilityLabel="Receber notificações neste celular"
                disabled={busy}
                value={pushEnabled}
                onValueChange={(value) => void setPushEnabled(value)}
                trackColor={{ true: colors.brand, false: colors.border }}
                thumbColor={colors.surface}
              />
            }
          />
          <ListRow
            title="Lembrar carrinho pendente"
            divider
            right={
              <Switch
                accessibilityLabel="Lembrar carrinho pendente"
                value={preferences.cartReminders}
                disabled={!pushEnabled || busy}
                onValueChange={(value) => void updatePreference('cartReminders', value)}
                trackColor={{ true: colors.brand, false: colors.border }}
                thumbColor={colors.surface}
              />
            }
          />
          <ListRow
            title="Ofertas dos produtos que compro"
            subtitle="Usa só as compras que você confirmar no app."
            divider
            right={
              <Switch
                accessibilityLabel="Ofertas dos produtos que compro"
                value={preferences.personalizedOffers}
                disabled={!pushEnabled || busy}
                onValueChange={(value) => void updatePreference('personalizedOffers', value)}
                trackColor={{ true: colors.brand, false: colors.border }}
                thumbColor={colors.surface}
              />
            }
          />
          {pushError ? (
            <View style={styles.cardBodyPad}>
              <Notice tone="error" message={pushError} />
            </View>
          ) : null}
        </Card>

        <Card padded={false}>
          <ListRow icon="map-pin" title="Lojas" onPress={() => router.push('/lojas')} />
          <ListRow
            icon="briefcase"
            title="Área do lojista"
            divider
            onPress={() => router.push('/admin')}
          />
          <ListRow
            icon="help-circle"
            title="Ajuda e suporte"
            divider
            onPress={() =>
              showMessage('Ajuda e suporte', 'Fale com a gente pelo e-mail contato@scanmercado.com.br')
            }
          />
        </Card>

        <Card padded={false}>
          <ListRow icon="log-out" title="Sair da conta" onPress={logout} danger />
        </Card>
      </Screen>
    );
  }

  const handleLogin = async () => {
    if (registering && name.trim().length < 2) {
      setLoginError('Informe seu nome.');
      return;
    }
    if (cpf.length !== 11 || password.length === 0) {
      setLoginError('Digite o CPF (11 dígitos) e a senha.');
      return;
    }
    setIsSubmitting(true);
    setLoginError(null);
    const result = registering ? await register(name, cpf, password) : await login(cpf, password);
    setIsSubmitting(false);

    if (result.status === 'invalid_credentials') {
      setLoginError(result.message ?? 'CPF ou senha incorretos.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        header={
          <ScreenHeader
            title="Conta"
            subtitle="Entre para ver seus pontos e ativar ofertas do clube."
          />
        }
      >
        <Card style={styles.stack}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>
              {registering ? 'Criar conta do clube' : 'Entrar'}
            </Text>
            {!isApiConfigured ? <Badge label="Demonstração" /> : null}
          </View>
          {loginError ? <Notice tone="error" message={loginError} /> : null}
          {registering ? (
            <TextField
              label="Nome"
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              autoComplete="name"
            />
          ) : null}
          <TextField
            label="CPF"
            placeholder="Somente números"
            keyboardType="numeric"
            maxLength={11}
            value={cpf}
            onChangeText={(value) => setCpf(formatCpfInput(value))}
          />
          <TextField
            label="Senha"
            placeholder="••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            hint={registering ? 'Mínimo de 8 caracteres.' : undefined}
          />
          <Button
            label={registering ? 'Criar conta' : 'Entrar'}
            onPress={handleLogin}
            loading={isSubmitting}
            fullWidth
          />
          {demo.enabled ? (
            <Button
              label="Usar conta fictícia da apresentação"
              variant="ghost"
              onPress={() => router.push('/demonstracao')}
            />
          ) : isApiConfigured ? (
            <Button
              label={registering ? 'Já tenho conta' : 'Criar conta do clube'}
              variant="ghost"
              onPress={() => {
                setRegistering(!registering);
                setLoginError(null);
              }}
              disabled={isSubmitting}
            />
          ) : (
            <Text style={styles.demoHint}>Demonstração: CPF 12345678900, senha 123456</Text>
          )}
        </Card>

        <BudgetSection />

        <Card padded={false}>
          <ListRow icon="map-pin" title="Lojas" onPress={() => router.push('/lojas')} />
          <ListRow
            icon="briefcase"
            title="Área do lojista"
            divider
            onPress={() => router.push('/admin')}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: spacing.md },
  inlineForm: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...typography.h2, color: colors.text },
  cardSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  cardHeaderPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  cardBodyPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
  },
  sectionTitle: { ...typography.h2, color: colors.text },
  emptyHint: { ...typography.caption, color: colors.textMuted },
  amount: { ...typography.bodyStrong, color: colors.text },
  demoHint: { ...typography.small, color: colors.textMuted, textAlign: 'center' },
  budgetCurrent: { ...typography.caption, color: colors.brandDark, fontWeight: '600' },
  memberCard: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  memberTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.onDarkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onBrand, fontSize: 20, fontWeight: '800' },
  memberName: { ...typography.h2, color: colors.onBrand },
  memberMeta: { ...typography.caption, color: colors.textFaint, marginTop: 2 },
  tierBadge: {
    backgroundColor: colors.onDarkSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  tierBadgeText: { color: colors.onBrand, ...typography.small, fontWeight: '700' },
  memberBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
