import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MOCK_PRODUCTS } from '../data/products';
import { MEMBER_PROMOTIONS } from '../data/memberPromotions';
import { useAuth } from '../context/AuthContext';
import { usePromotions } from '../context/PromotionsContext';
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
  container: { flex: 1, backgroundColor: '#fff' },
  section: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  sectionSubtitle: { fontSize: 13, color: '#777', marginTop: 4 },
  loginHint: { fontSize: 13, color: '#1DB954', marginTop: 4, fontWeight: '600' },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FFF7F5',
    borderRadius: 12,
    gap: 8,
  },
  productName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  productPrice: { fontSize: 13, color: '#777', marginTop: 2 },
  storeBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C0392B',
    backgroundColor: '#FBE4E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F3F3F3',
    borderRadius: 12,
    gap: 8,
  },
  memberCardActive: { backgroundColor: '#E8F8ED' },
  memberLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  memberExtra: { fontSize: 13, color: '#1DB954', marginTop: 2, fontWeight: '700' },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1DB954',
  },
  toggleActive: { backgroundColor: '#1DB954' },
  toggleText: { color: '#1DB954', fontWeight: '700', fontSize: 12 },
  toggleTextActive: { color: '#fff' },
});
