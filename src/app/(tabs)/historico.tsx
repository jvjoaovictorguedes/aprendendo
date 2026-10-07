import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ListRow,
  Notice,
  Screen,
  ScreenHeader,
} from '../../components/ui';
import { useCart } from '../../context/CartContext';
import { useHistory } from '../../context/HistoryContext';
import { CartItem, cartItemKey, Purchase } from '../../types';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatBRL, formatKg } from '../../utils/pricing';
import { showMessage } from '../../utils/dialogs';

function itemDescription(item: CartItem): string {
  if (item.weighed) {
    const weight = formatKg(item.weighed.weightKg, item.weighed.weightIsEstimated);
    return `${item.quantity}x ${weight} (${formatBRL(item.product.price)}/kg)`;
  }
  return `${item.quantity}x ${formatBRL(item.product.price)}`;
}

function itemSubtotal(item: CartItem): number {
  return (item.weighed ? item.weighed.labelTotal : item.product.price) * item.quantity;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { purchases } = useHistory();
  const { addByBarcode } = useCart();
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [isBuyingAgain, setIsBuyingAgain] = useState(false);

  const handleBuyAgain = async (purchase: Purchase) => {
    setIsBuyingAgain(true);
    // Produto pesado depende de uma etiqueta nova da balança — não dá pra repetir.
    const repeatable = purchase.items.filter((item) => !item.weighed);
    const skipped = purchase.items.length - repeatable.length;
    for (const item of repeatable) {
      for (let i = 0; i < item.quantity; i += 1) {
        await addByBarcode(item.product.barcode);
      }
    }
    setIsBuyingAgain(false);
    showMessage(
      'Itens adicionados',
      `${repeatable.length} produto(s) dessa compra foram para o carrinho, com os preços de hoje.` +
        (skipped > 0
          ? ` ${skipped} item(ns) da balança ficaram de fora — pese de novo na loja.`
          : ''),
      () => router.push('/cart'),
    );
  };

  if (selected) {
    const weighedCount = selected.items.filter((item) => item.weighed).length;
    return (
      <Screen
        header={
          <ScreenHeader
            title={new Date(selected.date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
            subtitle={`${selected.items.length} produto(s)`}
            onBack={() => setSelected(null)}
          />
        }
        footer={
          <Button
            label="Comprar novamente"
            onPress={() => handleBuyAgain(selected)}
            loading={isBuyingAgain}
            fullWidth
          />
        }
      >
        <Card style={styles.summary}>
          <Text style={styles.summaryLabel}>Total da compra</Text>
          <Text style={styles.summaryTotal}>{formatBRL(selected.finalTotal)}</Text>
          {selected.savings > 0 ? (
            <Badge label={`Economizou ${formatBRL(selected.savings)}`} variant="brand" />
          ) : null}
        </Card>
        {weighedCount > 0 ? (
          <Notice message="Itens da balança não entram no “Comprar novamente”: pese de novo na loja." />
        ) : null}
        <Card padded={false}>
          {selected.items.map((item, index) => (
            <ListRow
              key={cartItemKey(item)}
              title={item.product.name}
              subtitle={itemDescription(item)}
              divider={index > 0}
              right={<Text style={styles.itemSubtotal}>{formatBRL(itemSubtotal(item))}</Text>}
            />
          ))}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen header={<ScreenHeader title="Histórico" subtitle="Suas compras salvas." back />}>
      {purchases.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title="Nenhuma compra salva ainda"
          subtitle="Ao terminar uma compra no carrinho, ela aparece aqui."
          actionLabel="Começar compra"
          onAction={() => router.push('/comprar')}
        />
      ) : (
        <Card padded={false}>
          {purchases.map((purchase, index) => (
            <ListRow
              key={purchase.id}
              icon="shopping-bag"
              title={new Date(purchase.date).toLocaleDateString('pt-BR')}
              subtitle={
                `${purchase.items.length} produto(s)` +
                (purchase.savings > 0 ? ` · economizou ${formatBRL(purchase.savings)}` : '')
              }
              divider={index > 0}
              onPress={() => setSelected(purchase)}
              right={<Text style={styles.itemSubtotal}>{formatBRL(purchase.finalTotal)}</Text>}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.xs },
  summaryLabel: { ...typography.caption, color: colors.textMuted },
  summaryTotal: { ...typography.display, color: colors.text },
  itemSubtotal: { ...typography.bodyStrong, color: colors.text },
});
