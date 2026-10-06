import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { usePromotions } from '../../context/PromotionsContext';
import { MEMBER_PROMOTIONS } from '../../data/memberPromotions';
import { MOCK_PRODUCTS } from '../../data/products';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { formatBRL } from '../../utils/pricing';
import { getTierProgress } from '../../utils/loyalty';

const storePromotions = MOCK_PRODUCTS.filter((product) => product.promotion);
const CATEGORIES = ['Todos', ...Array.from(new Set(storePromotions.map((product) => product.category)))];

export default function PromotionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isActivated, toggleActivation } = usePromotions();
  const [category, setCategory] = useState('Todos');

  const filteredPromotions = useMemo(
    () =>
      category === 'Todos'
        ? storePromotions
        : storePromotions.filter((product) => product.category === category),
    [category],
  );

  const tierProgress = user ? getTierProgress(user.points) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.header}>
        <Text style={styles.title}>Ofertas e cupons</Text>
        <Text style={styles.subtitle}>Descontos da loja e cupons só para você</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: spacing.lg }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
      >
        {CATEGORIES.map((item) => {
          const active = item === category;
          return (
            <TouchableOpacity
              key={item}
              onPress={() => setCategory(item)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tierProgress ? (
        <View style={styles.sectionPadding}>
          <View style={styles.loyaltyCard}>
            <View style={styles.loyaltyRow}>
              <View style={styles.loyaltyPointsRow}>
                <Icon name="star" size={16} color={colors.starGold} />
                <Text style={styles.loyaltyPoints}>{user!.points} pontos · Nível {tierProgress.tier}</Text>
              </View>
              <Text style={styles.loyaltyHint}>
                {tierProgress.nextTier ? `Faltam ${tierProgress.pointsToNext} pts` : 'Nível máximo'}
              </Text>
            </View>
            <View style={styles.loyaltyTrack}>
              <View style={[styles.loyaltyFill, { width: `${tierProgress.progressRatio * 100}%` }]} />
            </View>
            <Text style={styles.loyaltySubtitle}>
              {tierProgress.nextTier
                ? `Alcance o nível ${tierProgress.nextTier} e desbloqueie mais benefícios`
                : 'Você já aproveita os maiores benefícios do clube'}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.sectionPadding, { marginTop: spacing.xl }]}>
        <Text style={styles.sectionTitle}>Cupons para você</Text>
        {user ? (
          <Text style={styles.sectionSubtitle}>Ative antes de bipar — o desconto entra automaticamente no carrinho.</Text>
        ) : (
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <Text style={styles.loginHint}>Entre na aba Conta para ativar essas ofertas.</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sectionPadding}>
        {MEMBER_PROMOTIONS.map((promo) => {
          const active = user ? isActivated(promo.id) : false;
          return (
            <TouchableOpacity
              key={promo.id}
              style={[styles.couponCard, active && styles.couponCardActive]}
              disabled={!user}
              onPress={() => toggleActivation(promo.id)}
            >
              <View style={[styles.couponIconWrap, active && { backgroundColor: colors.surface }]}>
                <Icon name="tag" size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.couponLabel}>{promo.label}</Text>
                <Text style={styles.couponExtra}>-{promo.extraPercentOff}% extra</Text>
              </View>
              <View style={[styles.toggle, active && styles.toggleActive]}>
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                  {active ? 'Ativada ✓' : 'Ativar'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.sectionPadding, { marginTop: spacing.lg }]}>
        <Text style={styles.sectionTitle}>Ofertas da loja</Text>
        <Text style={styles.sectionSubtitle}>Válidas para qualquer cliente, aplicadas automaticamente ao bipar.</Text>
      </View>

      <View style={[styles.sectionPadding, styles.grid]}>
        {filteredPromotions.map((product) => (
          <View key={product.barcode} style={styles.storeCard}>
            <Text style={styles.storeBadge}>{product.promotion?.label}</Text>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={styles.productPrice}>{formatBRL(product.price)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  sectionPadding: { paddingHorizontal: spacing.lg },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...typography.small, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.onBrand },
  loyaltyCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  loyaltyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loyaltyPointsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  loyaltyPoints: { color: colors.onBrand, ...typography.bodyStrong },
  loyaltyHint: { color: colors.textFaint, ...typography.small },
  loyaltyTrack: { height: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)' },
  loyaltyFill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.brand },
  loyaltySubtitle: { color: colors.textFaint, ...typography.small },
  sectionTitle: { ...typography.h2, color: colors.text },
  sectionSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  loginHint: { ...typography.caption, color: colors.brand, marginTop: 4, fontWeight: '600' },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  couponCardActive: { backgroundColor: colors.brandSoft },
  couponIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponLabel: { ...typography.bodyStrong, color: colors.text },
  couponExtra: { ...typography.caption, color: colors.brand, marginTop: 2, fontWeight: '700' },
  toggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  toggleActive: { backgroundColor: colors.brand },
  toggleText: { color: colors.brand, fontWeight: '700', fontSize: 12 },
  toggleTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  storeCard: {
    width: '47%',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    gap: 4,
  },
  storeBadge: {
    alignSelf: 'flex-start',
    ...typography.small,
    fontWeight: '700',
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  productName: { ...typography.bodyStrong, color: colors.text },
  productPrice: { ...typography.body, color: colors.text, fontWeight: '700' },
});
