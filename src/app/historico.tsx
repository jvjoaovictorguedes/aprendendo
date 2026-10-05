import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Badge, Button, Card, EmptyState } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useHistory } from '../context/HistoryContext';
import { Purchase } from '../types';
import { colors, spacing, typography } from '../theme/tokens';
import { formatBRL } from '../utils/pricing';

export default function HistoryScreen() {
  const router = useRouter();
  const { purchases } = useHistory();
  const { addByBarcode } = useCart();
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [isBuyingAgain, setIsBuyingAgain] = useState(false);

  const handleBuyAgain = async (purchase: Purchase) => {
    setIsBuyingAgain(true);
    for (const item of purchase.items) {
      for (let i = 0; i < item.quantity; i += 1) {
         
        await addByBarcode(item.product.barcode);
      }
    }
    setIsBuyingAgain(false);
    Alert.alert(
      'Itens adicionados',
      `${purchase.items.length} produto(s) dessa compra foram adicionados ao seu carrinho atual, com os preços de hoje.`,
      [{ text: 'Ver carrinho', onPress: () => router.push('/cart') }],
    );
  };

  if (purchases.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          emoji="🧾"
          title="Nenhuma compra finalizada ainda"
          subtitle="Suas compras aparecem aqui depois que você finaliza no carrinho."
        />
      </View>
    );
  }

  if (selected) {
    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}>
            <Text style={styles.backLink}>‹ Histórico</Text>
          </TouchableOpacity>
          <Text style={styles.detailDate}>
            {new Date(selected.date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <Text style={styles.detailTotal}>{formatBRL(selected.finalTotal)}</Text>
          {selected.savings > 0 ? (
            <Badge label={`Economizou ${formatBRL(selected.savings)}`} variant="brand" />
          ) : null}
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
          {selected.items.map((item) => (
            <Card key={item.product.barcode} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemQty}>
                  {item.quantity}x {formatBRL(item.product.price)}
                </Text>
              </View>
              <Text style={styles.itemSubtotal}>
                {formatBRL(item.product.price * item.quantity)}
              </Text>
            </Card>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Comprar novamente"
            onPress={() => handleBuyAgain(selected)}
            loading={isBuyingAgain}
            fullWidth
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
        {purchases.map((purchase) => (
          <TouchableOpacity key={purchase.id} onPress={() => setSelected(purchase)}>
            <Card style={styles.purchaseRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.purchaseDate}>
                  {new Date(purchase.date).toLocaleDateString('pt-BR')}
                </Text>
                <Text style={styles.purchaseItems}>{purchase.items.length} produto(s)</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.purchaseTotal}>{formatBRL(purchase.finalTotal)}</Text>
                {purchase.savings > 0 ? (
                  <Text style={styles.purchaseSavings}>
                    economizou {formatBRL(purchase.savings)}
                  </Text>
                ) : null}
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
  purchaseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  purchaseDate: { ...typography.bodyStrong, color: colors.text },
  purchaseItems: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  purchaseTotal: { ...typography.h2, color: colors.text },
  purchaseSavings: { ...typography.small, color: colors.brandDark, marginTop: 2 },
  detailHeader: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  backLink: { ...typography.bodyStrong, color: colors.brand },
  detailDate: { ...typography.h2, color: colors.text, marginTop: spacing.sm },
  detailTotal: { ...typography.display, color: colors.text },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemName: { ...typography.bodyStrong, color: colors.text },
  itemQty: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  itemSubtotal: { ...typography.bodyStrong, color: colors.text },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
