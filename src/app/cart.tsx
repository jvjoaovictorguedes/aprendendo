import { useRouter } from 'expo-router';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { ProductRow } from '../components/ProductRow';
import { Button, EmptyState } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { useHistory } from '../context/HistoryContext';
import { usePromotions } from '../context/PromotionsContext';
import { colors, spacing, typography } from '../theme/tokens';
import { computeCartTotals, formatBRL } from '../utils/pricing';

export default function CartScreen() {
  const router = useRouter();
  const { items, incrementItem, decrementItem, removeItem, clearCart } = useCart();
  const { extraPercentOffFor } = usePromotions();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addPurchase } = useHistory();
  const totals = computeCartTotals(items, extraPercentOffFor);

  const confirmClear = () => {
    Alert.alert('Limpar carrinho', 'Remover todos os itens escaneados?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: clearCart },
    ]);
  };

  const handleCheckout = () => {
    Alert.alert(
      'Finalizar compra',
      'Isso arquiva a compra no seu histórico e esvazia o carrinho. O pagamento continua sendo feito no caixa — este é só o resumo do que você escaneou.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: () => {
            addPurchase(items, {
              originalTotal: totals.originalTotal,
              finalTotal: totals.finalTotal,
              savings: totals.savings,
            });
            clearCart();
            router.push('/historico');
          },
        },
      ],
    );
  };

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <EmptyState
          emoji="🛒"
          title="Seu carrinho está vazio"
          subtitle="Vá até Comprar e bipe o primeiro produto."
          actionLabel="Ir para Comprar"
          onAction={() => router.push('/comprar')}
        />
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
            isFavorite={isFavorite(item.product.barcode)}
            onToggleFavorite={() => toggleFavorite(item.product.barcode)}
            onIncrement={() => incrementItem(item.product.barcode)}
            onDecrement={() => decrementItem(item.product.barcode)}
            onRemove={() => removeItem(item.product.barcode)}
          />
        )}
        contentContainerStyle={{ paddingBottom: spacing.md }}
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatBRL(totals.originalTotal)}</Text>
        </View>
        {totals.savings > 0 ? (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, styles.savingsLabel]}>Descontos</Text>
            <Text style={styles.savingsLabel}>- {formatBRL(totals.savings)}</Text>
          </View>
        ) : null}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total estimado</Text>
          <Text style={styles.totalValue}>{formatBRL(totals.finalTotal)}</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Limpar" variant="danger" onPress={confirmClear} />
          <Button
            label="Continuar comprando"
            variant="secondary"
            onPress={() => router.push('/comprar')}
            style={{ flex: 1 }}
          />
        </View>
        <Button
          label="Finalizar compra"
          onPress={handleCheckout}
          fullWidth
          style={{ marginTop: spacing.sm }}
        />
        <Text style={styles.disclaimer}>
          Este app não substitui o caixa. Valores finais podem variar conforme validação no PDV.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  empty: { flex: 1, justifyContent: 'center', backgroundColor: colors.surface },
  summary: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { ...typography.body, color: colors.textMuted },
  summaryValue: { ...typography.body, color: colors.textMuted },
  savingsLabel: { ...typography.caption, color: colors.brand, fontWeight: '600' },
  totalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { ...typography.h2, color: colors.text },
  totalValue: { ...typography.display, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  disclaimer: {
    ...typography.small,
    color: colors.textFaint,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
