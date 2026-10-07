import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  HeaderIconButton,
  Icon,
  Notice,
  Screen,
  SearchField,
  Section,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useHistory } from '../../context/HistoryContext';
import { useLists } from '../../context/ListsContext';
import { useNotifications } from '../../context/NotificationsContext';
import { usePromotions } from '../../context/PromotionsContext';
import { StoreSelector } from '../../components/StoreSelector';
import { isApiConfigured } from '../../services/api';
import { offerPromotion } from '../../utils/offers';
import { MOCK_PRODUCTS } from '../../data/products';
import { brand, colors, radius, spacing, typography } from '../../theme/tokens';
import { computeCartTotals, computeLineTotal, formatBRL } from '../../utils/pricing';

const QUICK_ACTIONS = [
  { label: 'Cupons', icon: 'tag', href: '/promotions' },
  { label: 'Histórico', icon: 'clock', href: '/historico' },
  { label: 'Lojas', icon: 'map-pin', href: '/lojas' },
] as const;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, addByBarcode } = useCart();
  const { extraPercentOffFor, offers } = usePromotions();
  const storeOffers = offers
    .filter((o) => o.audience === 'all')
    .slice(0, 3)
    .map((o) => ({ ...o.product, promotion: offerPromotion(o) }));
  const { lists } = useLists();
  const { purchases } = useHistory();
  const { unreadCount } = useNotifications();
  const [query, setQuery] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const totals = computeCartTotals(items, extraPercentOffFor);
  const hasActiveCart = items.length > 0;
  const recentLists = lists.slice(0, 2);
  const recentPurchase = purchases[0];
  const availableMemberOffers = offers.filter((o) => o.audience === 'club').length;

  const searchMatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return (
      isApiConfigured
        ? Array.from(new Map(offers.map((o) => [o.product.barcode, o.product])).values())
        : MOCK_PRODUCTS
    )
      .filter((product) => product.name.toLowerCase().includes(normalized))
      .slice(0, 4);
  }, [query, offers]);

  const handleQuickAdd = async (barcode: string) => {
    const result = await addByBarcode(barcode);
    if (result.status !== 'added') {
      setAddError(result.status === 'error' ? result.message : 'Produto indisponível na loja.');
      return;
    }
    setAddError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setQuery('');
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        {brand.logoUrl ? (
          <Image
            source={{ uri: brand.logoUrl }}
            style={styles.logo}
            accessibilityLabel={brand.name}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {getGreeting()}
            {user ? `, ${user.name.split(' ')[0]}` : ''}
          </Text>
          <Text style={styles.store}>{brand.name}</Text>
        </View>
        <HeaderIconButton
          icon="bell"
          label="Notificações"
          onPress={() => router.push('/notifications')}
          badge={unreadCount > 0}
        />
      </View>

      <View style={[styles.sectionPadding, styles.stack]}>
        <StoreSelector />
        <SearchField
          placeholder="Buscar ofertas por produto…"
          value={query}
          onChangeText={setQuery}
        />
        {addError ? <Notice tone="error" message={addError} /> : null}
        {searchMatches.length > 0 ? (
          <Card style={styles.searchResults}>
            {searchMatches.map((product) => (
              <View key={product.barcode} style={styles.searchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.searchName}>{product.name}</Text>
                  <Text style={styles.searchPrice}>{formatBRL(product.price)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.searchAddButton}
                  onPress={() => handleQuickAdd(product.barcode)}
                  accessibilityLabel={`Adicionar ${product.name} ao carrinho`}
                >
                  <Icon name="plus" size={16} color={colors.onBrand} />
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        ) : null}
      </View>

      <View style={styles.ctaWrapper}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/comprar')}
          accessibilityRole="button"
          accessibilityLabel="Começar compra"
        >
          <View style={styles.ctaIconWrap}>
            <Icon name="camera" size={22} color={colors.onBrand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>
              {hasActiveCart ? 'Continuar comprando' : 'Começar compra'}
            </Text>
            <Text style={styles.ctaSubtitle}>Bipe os produtos e acompanhe o total</Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.onBrand} />
        </TouchableOpacity>
      </View>

      {hasActiveCart ? (
        <View style={styles.sectionPadding}>
          <Card>
            <View style={styles.cartRow}>
              <View>
                <Text style={styles.cartLabel}>Carrinho atual</Text>
                <Text style={styles.cartItemCount}>{totals.itemCount} item(ns)</Text>
              </View>
              <Text style={styles.cartTotal}>{formatBRL(totals.finalTotal)}</Text>
            </View>
            <Button
              label="Ver carrinho"
              variant="secondary"
              onPress={() => router.push('/cart')}
              style={{ marginTop: spacing.md }}
              fullWidth
            />
          </Card>
        </View>
      ) : null}

      <View style={[styles.sectionPadding, styles.quickActions]}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.quickAction}
            onPress={() => router.push(action.href)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <View style={styles.quickActionIcon}>
              <Icon name={action.icon} size={21} color={colors.brandDark} />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Section
        title="Ofertas para você"
        actionLabel="Ver todas"
        onAction={() => router.push('/promotions')}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: spacing.md,
          }}
        >
          {storeOffers.map((product) => (
            <Card key={product.barcode} style={styles.offerCard}>
              <Badge label={product.promotion?.label ?? ''} variant="danger" />
              <Text style={styles.offerName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.offerPrice}>
                {formatBRL(
                  computeLineTotal({
                    product,
                    quantity: product.promotion?.kind === 'buyXPayY' ? product.promotion.buy : 1,
                  }).finalTotal,
                )}
                {product.promotion?.kind === 'buyXPayY'
                  ? ` por ${product.promotion.buy} unidades`
                  : `/${product.unit}`}
              </Text>
            </Card>
          ))}
          {availableMemberOffers > 0 ? (
            <Card style={[styles.offerCard, { backgroundColor: colors.brandSoft }]}>
              <Badge label="Exclusivo" variant="brand" />
              <Text style={styles.offerName}>
                {availableMemberOffers} ofertas de cliente disponíveis
              </Text>
              <Text style={styles.offerLink}>Ativar na aba Ofertas</Text>
            </Card>
          ) : null}
        </ScrollView>
      </Section>

      <View style={styles.sectionPadding}>
        <TouchableOpacity
          style={styles.couponBanner}
          onPress={() => router.push(user ? '/promotions' : '/profile')}
        >
          <View style={styles.couponIconWrap}>
            <Icon name="tag" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.couponTitle}>
              {user
                ? `Você tem ${availableMemberOffers} cupons disponíveis`
                : 'Faça login para ver cupons exclusivos'}
            </Text>
            <Text style={styles.couponSubtitle}>
              {user
                ? 'Ative nas ofertas ou durante a compra'
                : 'Entre na aba Conta para desbloquear'}
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.textFaint} />
        </TouchableOpacity>
      </View>

      <Section title="Suas listas" actionLabel="Ver todas" onAction={() => router.push('/listas')}>
        <View style={styles.sectionPadding}>
          {recentLists.length === 0 ? (
            <Card>
              <Text style={styles.emptyHint}>Você ainda não tem listas de compras.</Text>
              <Button
                label="Criar lista"
                variant="secondary"
                onPress={() => router.push('/listas')}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          ) : (
            recentLists.map((list) => {
              const boughtCount = list.items.filter((item) => item.bought).length;
              return (
                <TouchableOpacity key={list.id} onPress={() => router.push('/listas')}>
                  <Card style={{ marginBottom: spacing.sm }}>
                    <Text style={styles.listName}>{list.name}</Text>
                    <Text style={styles.listProgress}>
                      {boughtCount}/{list.items.length} itens comprados
                    </Text>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </Section>

      <Section
        title="Compras recentes"
        actionLabel="Ver tudo"
        onAction={() => router.push('/historico')}
      >
        <View style={styles.sectionPadding}>
          {recentPurchase ? (
            <TouchableOpacity onPress={() => router.push('/historico')}>
              <Card>
                <View style={styles.cartRow}>
                  <View>
                    <Text style={styles.cartLabel}>
                      {new Date(recentPurchase.date).toLocaleDateString('pt-BR')}
                    </Text>
                    <Text style={styles.cartItemCount}>
                      {recentPurchase.items.length} produto(s)
                    </Text>
                  </View>
                  <Text style={styles.cartTotal}>{formatBRL(recentPurchase.finalTotal)}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ) : (
            <Card>
              <Text style={styles.emptyHint}>Suas compras finalizadas aparecem aqui.</Text>
            </Card>
          )}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, gap: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    marginRight: spacing.xs,
  },
  greeting: { ...typography.h1, color: colors.text },
  store: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  sectionPadding: { paddingHorizontal: spacing.lg },
  stack: { gap: spacing.md },
  searchResults: { padding: spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  searchName: { ...typography.bodyStrong, color: colors.text },
  searchPrice: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  searchAddButton: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaWrapper: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  ctaButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.xxl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ctaIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.onDarkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: { ...typography.h2, color: colors.onBrand },
  ctaSubtitle: {
    ...typography.caption,
    color: colors.onBrand,
    opacity: 0.9,
    marginTop: 2,
  },
  quickActions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  quickAction: { flex: 1, alignItems: 'center', gap: spacing.sm },
  quickActionIcon: {
    width: '100%',
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  cartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartLabel: { ...typography.caption, color: colors.textMuted },
  cartItemCount: { ...typography.bodyStrong, color: colors.text, marginTop: 2 },
  cartTotal: { ...typography.h1, color: colors.text },
  offerCard: { width: 160 },
  offerName: {
    ...typography.bodyStrong,
    color: colors.text,
    marginTop: spacing.sm,
  },
  offerPrice: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  offerLink: {
    ...typography.small,
    color: colors.brandDark,
    marginTop: 2,
    fontWeight: '700',
  },
  couponBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  couponIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponTitle: { ...typography.bodyStrong, color: colors.text },
  couponSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  listName: { ...typography.bodyStrong, color: colors.text },
  listProgress: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyHint: { ...typography.body, color: colors.textMuted },
});
