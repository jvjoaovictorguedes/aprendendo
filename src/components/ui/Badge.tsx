import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme/tokens';

type Variant = 'brand' | 'danger' | 'warning' | 'neutral';

type Props = {
  label: string;
  variant?: Variant;
};

export function Badge({ label, variant = 'neutral' }: Props) {
  const palette = palettes[variant];
  return (
    <View style={[styles.base, { backgroundColor: palette.bg }]}>
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const palettes: Record<Variant, { bg: string; fg: string }> = {
  brand: { bg: colors.brandSoft, fg: colors.brandDark },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  neutral: { bg: colors.surfaceSunken, fg: colors.textMuted },
};

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  label: { ...typography.small, fontWeight: '700' },
});
