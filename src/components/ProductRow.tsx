import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from './ui';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { CartItem } from '../types';
import { computeLineTotal, LineTotal, formatBRL, formatKg } from '../utils/pricing';

type Props = {
  item: CartItem;
  extraPercentOff?: number;
  lineTotal?: LineTotal;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
};

export function ProductRow({
  item,
  extraPercentOff = 0,
  lineTotal,
  isFavorite,
  onToggleFavorite,
  onIncrement,
  onDecrement,
  onRemove,
}: Props) {
  const { originalTotal, finalTotal, savings } =
    lineTotal ?? computeLineTotal(item, extraPercentOff);
  const hasPromotion = savings > 0;

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={2}>
            {item.product.name}
          </Text>
          {onToggleFavorite ? (
            <TouchableOpacity
              onPress={onToggleFavorite}
              hitSlop={8}
              accessibilityLabel="Favoritar produto"
            >
              <Icon name="heart" size={16} color={isFavorite ? colors.danger : colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.unitPrice}>
          {formatBRL(item.product.price)} / {item.product.unit}
        </Text>
        {item.weighed ? (
          <Text style={styles.unitPrice}>
            Balança: {formatKg(item.weighed.weightKg, item.weighed.weightIsEstimated)} ·{' '}
            {formatBRL(item.weighed.labelTotal)}
          </Text>
        ) : null}
        {item.product.promotion ? (
          <Text style={styles.promoLabel}>{item.product.promotion.label}</Text>
        ) : null}
        {extraPercentOff > 0 ? (
          <Text style={styles.memberLabel}>Desconto de cliente ativo (-{extraPercentOff}%)</Text>
        ) : null}
      </View>

      <View style={styles.quantityControl}>
        <TouchableOpacity
          style={styles.stepButton}
          onPress={onDecrement}
          accessibilityLabel="Diminuir quantidade"
        >
          <Text style={styles.stepButtonText}>–</Text>
        </TouchableOpacity>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.stepButton}
          onPress={onIncrement}
          accessibilityLabel="Aumentar quantidade"
        >
          <Text style={styles.stepButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.totals}>
        {hasPromotion ? <Text style={styles.originalTotal}>{formatBRL(originalTotal)}</Text> : null}
        <Text style={styles.finalTotal}>{formatBRL(finalTotal)}</Text>
        <TouchableOpacity onPress={onRemove} accessibilityLabel="Remover item" hitSlop={8}>
          <Text style={styles.removeText}>remover</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  info: { flex: 1.4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  unitPrice: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  promoLabel: {
    ...typography.small,
    color: colors.danger,
    marginTop: 4,
    fontWeight: '600',
  },
  memberLabel: {
    ...typography.small,
    color: colors.brand,
    marginTop: 2,
    fontWeight: '600',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  quantity: {
    minWidth: 20,
    textAlign: 'center',
    ...typography.bodyStrong,
    color: colors.text,
  },
  totals: { alignItems: 'flex-end', minWidth: 90 },
  originalTotal: {
    ...typography.small,
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
  finalTotal: { ...typography.bodyStrong, color: colors.text },
  removeText: { ...typography.small, color: colors.danger, marginTop: 4 },
});
