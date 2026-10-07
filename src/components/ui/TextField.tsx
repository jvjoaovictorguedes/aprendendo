import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, minTouchSize, radius, spacing, typography } from '../../theme/tokens';
import { Icon } from './Icon';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Texto fixo antes do valor (ex.: "R$"). */
  prefix?: string;
};

/** Campo de texto padrão do app (rótulo, dica e erro no mesmo lugar). */
export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, hint, error, prefix, style, ...input },
  ref,
) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.box, error ? styles.boxError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={input.accessibilityLabel ?? label}
          style={[styles.input, style]}
          {...input}
        />
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

/** Busca em formato de pílula, com lupa. */
export function SearchField(props: TextInputProps) {
  return (
    <View style={styles.search}>
      <Icon name="search" size={17} color={colors.textFaint} />
      <TextInput
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
        returnKeyType="search"
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6, flexGrow: 1, flexShrink: 1 },
  label: { ...typography.small, fontWeight: '700', color: colors.textMuted },
  box: {
    minHeight: minTouchSize + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  boxError: { borderColor: colors.danger },
  prefix: { ...typography.bodyStrong, color: colors.textMuted },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  hint: { ...typography.small, color: colors.textMuted },
  error: { ...typography.small, color: colors.danger },
  search: {
    minHeight: minTouchSize + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
  },
});
