import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CartItem } from '../types';
import { computeLineTotal, formatBRL } from '../utils/pricing';

type Props = {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
};

export function ProductRow({ item, onIncrement, onDecrement, onRemove }: Props) {
  const { originalTotal, finalTotal, savings } = computeLineTotal(item);
  const hasPromotion = savings > 0;

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.product.name}</Text>
        <Text style={styles.unitPrice}>
          {formatBRL(item.product.price)} / {item.product.unit}
        </Text>
        {item.product.promotion ? (
          <Text style={styles.promoLabel}>🏷 {item.product.promotion.label}</Text>
        ) : null}
      </View>

      <View style={styles.quantityControl}>
        <TouchableOpacity style={styles.stepButton} onPress={onDecrement} accessibilityLabel="Diminuir quantidade">
          <Text style={styles.stepButtonText}>–</Text>
        </TouchableOpacity>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <TouchableOpacity style={styles.stepButton} onPress={onIncrement} accessibilityLabel="Aumentar quantidade">
          <Text style={styles.stepButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.totals}>
        {hasPromotion ? (
          <Text style={styles.originalTotal}>{formatBRL(originalTotal)}</Text>
        ) : null}
        <Text style={styles.finalTotal}>{formatBRL(finalTotal)}</Text>
        <TouchableOpacity onPress={onRemove} accessibilityLabel="Remover item">
          <Text style={styles.removeText}>remover</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    alignItems: 'center',
    gap: 8,
  },
  info: { flex: 1.4 },
  name: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  unitPrice: { fontSize: 12, color: '#777', marginTop: 2 },
  promoLabel: { fontSize: 12, color: '#C0392B', marginTop: 4, fontWeight: '600' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  quantity: { minWidth: 20, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  totals: { alignItems: 'flex-end', minWidth: 90 },
  originalTotal: { fontSize: 12, color: '#999', textDecorationLine: 'line-through' },
  finalTotal: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  removeText: { fontSize: 11, color: '#C0392B', marginTop: 4 },
});
