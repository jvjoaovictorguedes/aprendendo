import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme/tokens';

type Props = { label: string; selected?: boolean; onPress: () => void };

export function Chip({ label, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Fileira de filtros com rolagem lateral, alinhada às margens da tela. */
export function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.rowContent}
    >
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          selected={option === value}
          onPress={() => onChange(option)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  label: { ...typography.caption, fontWeight: '600', color: colors.textMuted },
  labelSelected: { color: colors.brandDark },
  // A fileira encosta nas bordas da tela e mantém o respiro lateral padrão.
  row: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  rowContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
});
