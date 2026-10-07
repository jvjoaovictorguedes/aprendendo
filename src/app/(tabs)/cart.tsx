import { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, FlatList, Platform, StyleSheet, Text, View } from 'react-native';

import { StoreSelector } from '../../components/StoreSelector';
import { OfferCard } from '../../components/OfferCard';
import { useAuth } from '../../context/AuthContext';
import { ProductRow } from '../../components/ProductRow';
import { Button, EmptyState } from '../../components/ui';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useHistory } from '../../context/HistoryContext';
import { usePromotions } from '../../context/PromotionsContext';
import { colors, spacing, typography } from '../../theme/tokens';
import { cartItemKey } from '../../types';
import { computeCartTotals, computeCartLines, formatBRL } from '../../utils/pricing';

export default function CartScreen() {
  const router = useRouter();
  const {
    items,
    incrementItem,
    decrementItem,
    removeItem,
    clearCart,
    refreshPrices,
    priceError,
    refreshing,
  } = useCart();
  const { extraPercentOffFor, offers, isActivated, refresh, error: offerError } = usePromotions();
  const { user } = useAuth();
  useFocusEffect(
    useCallback(() => {
      void refreshPrices();
      void refresh();
    }, [refreshPrices, refresh]),
  );
  const pendingOffers = offers.filter(
    (o) =>
      o.audience === 'club' &&
      !isActivated(o.id) &&
      items.some((i) => i.product.barcode === o.product.barcode),
  );
  const potential = computeCartTotals(items, (barcode) => {
    const quantity = items
      .filter((i) => i.product.barcode === barcode)
      .reduce((sum, i) => sum + i.quantity * (i.weighed?.weightKg ?? 1), 0);
    return offers
      .filter((o) => o.audience === 'club' && o.product.barcode === barcode)
      .reduce(
        (max, o) =>
          Math.max(
            max,
            (o.percent ?? 0) *
              (o.maxQuantity && quantity ? Math.min(1, o.maxQuantity / quantity) : 1),
          ),
        0,
      );
  });
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addPurchase } = useHistory();
  const lines = computeCartLines(items, extraPercentOffFor);
  const totals = computeCartTotals(items, extraPercentOffFor);

  const confirmClear = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm('Remover todos os itens escaneados?')) clearCart();
      return;
    }
    Alert.alert('Limpar carrinho', 'Remover todos os itens escaneados?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: clearCart },
    ]);
  };

  const finish = () => {
    addPurchase(items, {
      originalTotal: totals.originalTotal,
      finalTotal: totals.finalTotal,
      savings: totals.savings,
    });
    clearCart();
    router.push('/historico');
  };
  const handleCheckout = () => {
    if (priceError || refreshing) return;
    if (Platform.OS === 'web') {
      if (
        globalThis.confirm('Arquivar a prévia e limpar o carrinho? O pagamento continua no caixa.')
      )
        finish();
      return;
    }
    Alert.alert(
      'Finalizar compra',
      'Isso arquiva a compra no seu histórico e esvazia o carrinho. O pagamento continua sendo feito no caixa — este é só o resumo do que você escaneou.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: () => {
            finish();
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
        keyExtractor={cartItemKey}
        renderItem={({ item, index }) => (
          <ProductRow
            item={item}
            lineTotal={lines[index]}
            extraPercentOff={extraPercentOffFor(item.product.barcode)}
            isFavorite={isFavorite(item.product.barcode)}
            onToggleFavorite={() => toggleFavorite(item.product.barcode)}
            onIncrement={() => incrementItem(cartItemKey(item))}
            onDecrement={() => decrementItem(cartItemKey(item))}
            onRemove={() => removeItem(cartItemKey(item))}
          />
        )}
        ListHeaderComponent={
          <View>
            <StoreSelector />
            {priceError ? (
              <Text style={{ color: colors.danger, padding: spacing.md }}>
                Preços pendentes de atualização: {priceError}
              </Text>
            ) : null}
            {offerError ? (
              <Text style={{ color: colors.danger, padding: spacing.md }}>
                Não foi possível confirmar os cupons: {offerError}
              </Text>
            ) : null}
            <Button
              label={refreshing ? 'Atualizando preços…' : 'Atualizar preços e ofertas'}
              variant="ghost"
              disabled={refreshing}
              onPress={() => {
                void refreshPrices();
                void refresh();
              }}
            />
            {pendingOffers.map((o) => (
              <View key={o.id} style={{ paddingHorizontal: spacing.md }}>
                <OfferCard offer={o} />
              </View>
            ))}
          </View>
        }
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
        {pendingOffers.length && totals.finalTotal > potential.finalTotal ? (
          <Text style={styles.savingsLabel}>
            {user ? 'Ative os cupons acima' : 'Entre na conta e ative os cupons'} para economizar
            até mais {formatBRL(totals.finalTotal - potential.finalTotal)}. Este valor ainda não foi
            descontado.
          </Text>
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
          disabled={!!priceError || refreshing || !!offerError}
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
  savingsLabel: {
    ...typography.caption,
    color: colors.brand,
    fontWeight: '600',
  },
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
