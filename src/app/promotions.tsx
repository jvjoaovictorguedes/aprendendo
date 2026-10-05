import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MOCK_PRODUCTS } from '../data/products';
import { MEMBER_PROMOTIONS } from '../data/memberPromotions';
import { useAuth } from '../context/AuthContext';
import { usePromotions } from '../context/PromotionsContext';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { formatBRL } from '../utils/pricing';

const storePromotions = MOCK_PRODUCTS.filter((product) => product.promotion);

export default function PromotionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isActivated, toggleActivation } = usePromotions();

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ofertas da loja</Text>
            <Text style={styles.sectionSubtitle}>
              Válidas para qualquer cliente, aplicadas automaticamente ao bipar.
            </Text>
          </View>
          {storePromotions.map((product) => (
            <View key={product.barcode} style={styles.storeCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productPrice}>{formatBRL(product.price)}</Text>
              </View>
              <Text style={styles.storeBadge}>{product.promotion?.label}</Text>
            </View>
          ))}

          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>Ofertas exclusivas de cliente</Text>
            {user ? (
              <Text style={styles.sectionSubtitle}>
                Ative antes de bipar — o desconto entra automaticamente no carrinho.
              </Text>
            ) : (
              <TouchableOpacity onPress={() => router.push('/profile')}>
                <Text style={styles.loginHint}>
                  🔒 Faça login na aba Perfil para ativar essas ofertas.
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      }
      data={MEMBER_PROMOTIONS}
      keyExtractor={(promo) => promo.id}
      renderItem={({ item: promo }) => {
        const active = user ? isActivated(promo.id) : false;
        return (
          <TouchableOpacity
            style={[styles.memberCard, active && styles.memberCardActive]}
            disabled={!user}
            onPress={() => toggleActivation(promo.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.memberLabel}>{promo.label}</Text>
              <Text style={styles.memberExtra}>-{promo.extraPercentOff}% extra</Text>
            </View>
            <View style={[styles.toggle, active && styles.toggleActive]}>
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                {active ? 'Ativada ✓' : 'Ativar'}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  sectionTitle: { ...typography.h2, color: colors.text },
  sectionSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  loginHint: { ...typography.caption, color: colors.brand, marginTop: 4, fontWeight: '600' },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  productName: { ...typography.bodyStrong, color: colors.text },
  productPrice: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  storeBadge: {
    ...typography.small,
    fontWeight: '700',
    color: colors.danger,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  memberCardActive: { backgroundColor: colors.brandSoft },
  memberLabel: { ...typography.bodyStrong, color: colors.text },
  memberExtra: { ...typography.caption, color: colors.brand, marginTop: 2, fontWeight: '700' },
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
});
