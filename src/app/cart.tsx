import { useRouter } from 'expo-router';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ProductRow } from '../components/ProductRow';
import { useCart } from '../context/CartContext';
import { usePromotions } from '../context/PromotionsContext';
import { computeCartTotals, formatBRL } from '../utils/pricing';

export default function CartScreen() {
  const router = useRouter();
  const { items, incrementItem, decrementItem, removeItem, clearCart } = useCart();
  const { extraPercentOffFor } = usePromotions();
  const totals = computeCartTotals(items, extraPercentOffFor);

  const confirmClear = () => {
    Alert.alert('Limpar carrinho', 'Remover todos os itens escaneados?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: clearCart },
    ]);
  };

  const showCheckoutNotice = () => {
    Alert.alert(
      'Prévia do pagamento',
      'Este valor é uma estimativa com base nos itens escaneados. Confirme o total e as promoções no caixa antes de pagar.',
      [{ text: 'Entendi' }],
    );
  };

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🛒</Text>
        <Text style={styles.emptyTitle}>Seu carrinho está vazio</Text>
        <Text style={styles.emptySubtitle}>Vá até o Scanner e bipe o primeiro produto.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/')}>
          <Text style={styles.primaryButtonText}>Ir para o Scanner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.product.barcode}
        renderItem={({ item }) => (
          <ProductRow
            item={item}
            extraPercentOff={extraPercentOffFor(item.product.barcode)}
            onIncrement={() => incrementItem(item.product.barcode)}
            onDecrement={() => decrementItem(item.product.barcode)}
            onRemove={() => removeItem(item.product.barcode)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 12 }}
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatBRL(totals.originalTotal)}</Text>
        </View>
        {totals.savings > 0 ? (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, styles.savingsLabel]}>Economia com promoções</Text>
            <Text style={styles.savingsLabel}>- {formatBRL(totals.savings)}</Text>
          </View>
        ) : null}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total estimado</Text>
          <Text style={styles.totalValue}>{formatBRL(totals.finalTotal)}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={confirmClear}>
            <Text style={styles.secondaryButtonText}>Limpar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={showCheckoutNotice}>
            <Text style={styles.primaryButtonText}>Prévia do pagamento</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.disclaimer}>
          Este app não substitui o caixa. Valores finais podem variar conforme validação no PDV.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  emptySubtitle: { fontSize: 14, color: '#777', marginTop: 6, marginBottom: 20, textAlign: 'center' },
  summary: {
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    padding: 16,
    paddingBottom: 24,
    gap: 6,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: '#555' },
  summaryValue: { fontSize: 14, color: '#555' },
  savingsLabel: { fontSize: 13, color: '#1DB954', fontWeight: '600' },
  totalRow: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EEE' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1DB954',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#C0392B',
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#C0392B', fontWeight: '700' },
  disclaimer: { fontSize: 11, color: '#999', marginTop: 10, textAlign: 'center' },
});
