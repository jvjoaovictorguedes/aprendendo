import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Badge, Icon } from './ui';
import { colors, hitSlop, radius, spacing, typography } from '../theme/tokens';
import { CartItem } from '../types';
import { computeLineTotal, LineTotal, formatBRL, formatKg } from '../utils/pricing';

type Props = {
  item: CartItem;
  extraPercentOff?: number;
  lineTotal?: LineTotal;
  isFavorite?: boolean;
  /** Primeira/última linha do grupo: arredonda os cantos do cartão. */
  first?: boolean;
  last?: boolean;
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
  first,
  last,
  onToggleFavorite,
  onIncrement,
  onDecrement,
  onRemove,
}: Props) {
  const { originalTotal, finalTotal, savings } =
    lineTotal ?? computeLineTotal(item, extraPercentOff);
  const hasPromotion = savings > 0;

  return (
    <View style={[styles.row, first && styles.first, last && styles.last, !first && styles.divider]}>
      <View style={styles.top}>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {item.product.name}
          </Text>
          <Text style={styles.meta}>
            {item.weighed
              ? `${formatKg(item.weighed.weightKg, item.weighed.weightIsEstimated)} · ${formatBRL(item.product.price)}/kg`
              : `${formatBRL(item.product.price)}/${item.product.unit}`}
          </Text>
        </View>
        {onToggleFavorite ? (
          <TouchableOpacity
            onPress={onToggleFavorite}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remover dos favoritos' : 'Favoritar produto'}
          >
            <Icon name="heart" size={18} color={isFavorite ? colors.danger : colors.textFaint} />
          </TouchableOpacity>
        ) : null}
      </View>

      {item.product.promotion || extraPercentOff > 0 ? (
        <View style={styles.badges}>
          {item.product.promotion ? (
            <Badge label={item.product.promotion.label} variant="danger" />
          ) : null}
          {extraPercentOff > 0 ? (
            <Badge label={`Clube -${Math.round(extraPercentOff * 100) / 100}%`} variant="brand" />
          ) : null}
        </View>
      ) : null}

      <View style={styles.bottom}>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepButton}
            onPress={item.quantity > 1 ? onDecrement : onRemove}
            accessibilityRole="button"
            accessibilityLabel={item.quantity > 1 ? 'Diminuir quantidade' : 'Remover item'}
          >
            <Icon
              name={item.quantity > 1 ? 'minus' : 'trash-2'}
              size={15}
              color={item.quantity > 1 ? colors.text : colors.danger}
            />
          </TouchableOpacity>
          <Text style={styles.quantity}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.stepButton}
            onPress={onIncrement}
            accessibilityRole="button"
            accessibilityLabel="Aumentar quantidade"
          >
            <Icon name="plus" size={15} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.totals}>
          {hasPromotion ? (
            <Text style={styles.originalTotal}>{formatBRL(originalTotal)}</Text>
          ) : null}
          <Text style={styles.finalTotal}>{formatBRL(finalTotal)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  first: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  info: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  stepButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  quantity: {
    minWidth: 24,
    textAlign: 'center',
    ...typography.bodyStrong,
    color: colors.text,
  },
  totals: { alignItems: 'flex-end' },
  originalTotal: {
    ...typography.small,
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
  finalTotal: { ...typography.h2, color: colors.text },
});
