import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Badge, Button, Card, Section } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useHistory } from '../context/HistoryContext';
import { useLists } from '../context/ListsContext';
import { usePromotions } from '../context/PromotionsContext';
import { MEMBER_PROMOTIONS } from '../data/memberPromotions';
import { MOCK_PRODUCTS } from '../data/products';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { computeCartTotals, formatBRL } from '../utils/pricing';

const storeOffers = MOCK_PRODUCTS.filter((product) => product.promotion).slice(0, 3);

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { items } = useCart();
  const { extraPercentOffFor } = usePromotions();
  const { lists } = useLists();
  const { purchases } = useHistory();

  const totals = computeCartTotals(items, extraPercentOffFor);
  const hasActiveCart = items.length > 0;
  const recentLists = lists.slice(0, 2);
  const recentPurchase = purchases[0];
  const availableMemberOffers = MEMBER_PROMOTIONS.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {getGreeting()}{user ? `, ${user.name.split(' ')[0]}` : ''}
        </Text>
        <Text style={styles.store}>📍 ScanMercado — Loja Centro</Text>
      </View>

      <View style={styles.ctaWrapper}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/comprar')}
          accessibilityRole="button"
          accessibilityLabel="Começar compra"
        >
          <Text style={styles.ctaEmoji}>📷</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>
              {hasActiveCart ? 'Continuar comprando' : 'Começar compra'}
            </Text>
            <Text style={styles.ctaSubtitle}>Bipe os produtos e acompanhe o total</Text>
          </View>
          <Text style={styles.ctaArrow}>›</Text>
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

      <Section title="Ofertas para você" actionLabel="Ver todas" onAction={() => router.push('/promotions')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {storeOffers.map((product) => (
            <Card key={product.barcode} style={styles.offerCard}>
              <Badge label={product.promotion?.label ?? ''} variant="danger" />
              <Text style={styles.offerName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.offerPrice}>{formatBRL(product.price)}</Text>
            </Card>
          ))}
          {availableMemberOffers > 0 ? (
            <Card style={[styles.offerCard, { backgroundColor: colors.brandSoft }]}>
              <Badge label="Exclusivo" variant="brand" />
              <Text style={styles.offerName}>{availableMemberOffers} ofertas de cliente disponíveis</Text>
              <Text style={styles.offerLink}>Ativar na aba Promoções</Text>
            </Card>
          ) : null}
        </ScrollView>
      </Section>

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

      <Section title="Compras recentes" actionLabel="Ver tudo" onAction={() => router.push('/historico')}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  greeting: { ...typography.h1, color: colors.text },
  store: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  ctaWrapper: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  ctaButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ctaEmoji: { fontSize: 32 },
  ctaTitle: { ...typography.h2, color: colors.onBrand },
  ctaSubtitle: { ...typography.caption, color: colors.onBrand, opacity: 0.9, marginTop: 2 },
  ctaArrow: { ...typography.display, color: colors.onBrand },
  sectionPadding: { paddingHorizontal: spacing.lg },
  cartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartLabel: { ...typography.caption, color: colors.textMuted },
  cartItemCount: { ...typography.bodyStrong, color: colors.text, marginTop: 2 },
  cartTotal: { ...typography.h1, color: colors.text },
  offerCard: { width: 160 },
  offerName: { ...typography.bodyStrong, color: colors.text, marginTop: spacing.sm },
  offerPrice: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  offerLink: { ...typography.small, color: colors.brandDark, marginTop: 2, fontWeight: '700' },
  listName: { ...typography.bodyStrong, color: colors.text },
  listProgress: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  emptyHint: { ...typography.body, color: colors.textMuted },
});
