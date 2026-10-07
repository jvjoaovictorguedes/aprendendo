import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { StoreSelector } from '../../components/StoreSelector';
import { OfferCard } from '../../components/OfferCard';
import { useAuth } from '../../context/AuthContext';
import { ProductRow } from '../../components/ProductRow';
import { Button, EmptyState, Notice, Screen, ScreenHeader } from '../../components/ui';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useHistory } from '../../context/HistoryContext';
import { usePromotions } from '../../context/PromotionsContext';
import { colors, spacing, typography } from '../../theme/tokens';
import { cartItemKey } from '../../types';
import { computeCartTotals, computeCartLines, formatBRL } from '../../utils/pricing';
import { useNotifications } from '../../context/NotificationsContext';
import { isApiConfigured } from '../../services/api';
import { confirmAction } from '../../utils/dialogs';

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
  const { confirmPurchase } = useNotifications();
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
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

  const confirmClear = () =>
    confirmAction({
      title: 'Limpar carrinho',
      message: 'Remover todos os itens escaneados?',
      confirmLabel: 'Limpar',
      destructive: true,
      onConfirm: clearCart,
    });

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
    confirmAction({
      title: 'Salvar prévia',
      message:
        'A compra vai para o seu histórico e o carrinho é esvaziado. O pagamento continua no caixa — isto é só o resumo do que você escaneou.',
      confirmLabel: 'Salvar prévia',
      onConfirm: finish,
    });
  };

  const handleConfirmedPurchase = () => {
    const submit = async () => {
      setConfirming(true);
      setConfirmationError(null);
      try {
        await confirmPurchase();
        finish();
      } catch (error) {
        setConfirmationError(
          error instanceof Error
            ? error.message
            : 'Não foi possível confirmar. Seu carrinho foi mantido.',
        );
      } finally {
        setConfirming(false);
      }
    };
    confirmAction({
      title: 'Confirmar compra no caixa',
      message:
        'Você já pagou estes itens no caixa? A confirmação registra seu histórico para recomendar ofertas. Ela não faz pagamento nem concede pontos.',
      confirmLabel: 'Já paguei',
      onConfirm: () => void submit(),
    });
  };

  const header = (
    <ScreenHeader
      title="Carrinho"
      subtitle={items.length ? `${totals.itemCount} item(ns) · prévia do caixa` : undefined}
      back
      right={
        items.length ? (
          <TouchableOpacity
            onPress={confirmClear}
            disabled={confirming}
            accessibilityRole="button"
            accessibilityLabel="Limpar carrinho"
          >
            <Text style={styles.clear}>Limpar</Text>
          </TouchableOpacity>
        ) : null
      }
    />
  );

  if (items.length === 0) {
    return (
      <Screen header={header}>
        <EmptyState
          emoji="🛒"
          title="Seu carrinho está vazio"
          subtitle="Bipe o primeiro produto para ver o total aqui."
          actionLabel="Começar compra"
          onAction={() => router.push('/comprar')}
        />
      </Screen>
    );
  }

  const blocked = confirming || !!priceError || refreshing || !!offerError;

  return (
    <Screen
      header={header}
      scroll={false}
      footer={
        <>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryLabel}>{formatBRL(totals.originalTotal)}</Text>
          </View>
          {totals.savings > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.savings}>Descontos</Text>
              <Text style={styles.savings}>- {formatBRL(totals.savings)}</Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total estimado</Text>
            <Text style={styles.totalValue}>{formatBRL(totals.finalTotal)}</Text>
          </View>
          {confirmationError ? <Notice tone="error" message={confirmationError} /> : null}
          {isApiConfigured && user ? (
            <Button
              label="Já paguei no caixa"
              onPress={handleConfirmedPurchase}
              loading={confirming}
              disabled={blocked}
              fullWidth
            />
          ) : null}
          <View style={styles.actions}>
            <Button
              label="Continuar comprando"
              variant="secondary"
              onPress={() => router.push('/comprar')}
              style={styles.flex}
            />
            <Button
              label="Salvar prévia"
              variant={isApiConfigured && user ? 'secondary' : 'primary'}
              onPress={handleCheckout}
              disabled={blocked}
              style={styles.flex}
            />
          </View>
          <Text style={styles.disclaimer}>
            Este app não substitui o caixa. O valor final é o do PDV.
          </Text>
        </>
      }
    >
      <FlatList
        data={items}
        keyExtractor={cartItemKey}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <StoreSelector />
            {priceError ? (
              <Notice
                tone="warning"
                title="Preços pendentes de atualização"
                message={priceError}
                actionLabel="Tentar de novo"
                onAction={() => void refreshPrices()}
              />
            ) : null}
            {offerError ? (
              <Notice
                tone="warning"
                title="Não foi possível confirmar os cupons"
                message={offerError}
                actionLabel="Tentar de novo"
                onAction={() => void refresh()}
              />
            ) : null}
            {pendingOffers.length && totals.finalTotal > potential.finalTotal ? (
              <Notice
                tone="success"
                title={`Economize até mais ${formatBRL(totals.finalTotal - potential.finalTotal)}`}
                message={
                  user
                    ? 'Ative os cupons do clube abaixo. Esse valor ainda não foi descontado.'
                    : 'Entre na sua conta e ative os cupons do clube. Esse valor ainda não foi descontado.'
                }
              />
            ) : null}
            {pendingOffers.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
            {refreshing ? <Text style={styles.updating}>Atualizando preços…</Text> : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <ProductRow
            item={item}
            first={index === 0}
            last={index === items.length - 1}
            lineTotal={lines[index]}
            extraPercentOff={extraPercentOffFor(item.product.barcode)}
            isFavorite={isFavorite(item.product.barcode)}
            onToggleFavorite={() => toggleFavorite(item.product.barcode)}
            onIncrement={() => {
              if (!confirming) incrementItem(cartItemKey(item));
            }}
            onDecrement={() => {
              if (!confirming) decrementItem(cartItemKey(item));
            }}
            onRemove={() => {
              if (!confirming) removeItem(cartItemKey(item));
            }}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  listHeader: { gap: spacing.md, marginBottom: spacing.md },
  clear: { ...typography.caption, color: colors.danger, fontWeight: '700' },
  updating: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { ...typography.body, color: colors.textMuted },
  savings: { ...typography.body, color: colors.brandDark, fontWeight: '600' },
  totalRow: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'baseline',
  },
  totalLabel: { ...typography.h2, color: colors.text },
  totalValue: { ...typography.display, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm },
  disclaimer: { ...typography.small, color: colors.textFaint, textAlign: 'center' },
});
