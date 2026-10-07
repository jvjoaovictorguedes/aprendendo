// Blocos de interface do painel admin. Pensados para funcionar igual no
// celular e no navegador: conteúdo centralizado com largura máxima, e
// mensagens na própria tela (Alert do React Native não aparece na web).

import { Children, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Icon } from '../ui';

const MAX_CONTENT_WIDTH = 960;

type PageProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
}>;

export function AdminPage({
  title,
  subtitle,
  onBack,
  backLabel = 'Voltar',
  actions,
  children,
}: PageProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topBarInner}>
          <Text style={styles.brand}>ScanMercado · Admin</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.back}>
              <Icon name="chevron-left" size={18} color={colors.brandDark} />
              <Text style={styles.backText}>{backLabel}</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 220 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {actions ? <View style={styles.actions}>{actions}</View> : null}
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AdminSection({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      <View style={{ gap: spacing.md, marginTop: spacing.md }}>{children}</View>
    </View>
  );
}

/** Linha que quebra em coluna em telas estreitas. */
export function FieldRow({ children }: PropsWithChildren) {
  return (
    <View style={styles.fieldRow}>
      {Children.map(children, (child) =>
        child ? <View style={styles.fieldCell}>{child}</View> : null,
      )}
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
};

export function Field({ label, hint, error, style, ...inputProps }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        style={[
          styles.input,
          error ? styles.inputError : null,
          inputProps.editable === false && styles.inputDisabled,
          style,
        ]}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

type Option<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.segmented, disabled && { opacity: 0.6 }]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[styles.segment, selected && styles.segmentSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.brand, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

export type Status = { kind: 'success' | 'error'; message: string } | null;

export function StatusMessage({ status }: { status: Status }) {
  if (!status) return null;
  const isError = status.kind === 'error';
  return (
    <View style={[styles.status, isError ? styles.statusError : styles.statusSuccess]}>
      <Icon
        name={isError ? 'alert-circle' : 'check-circle'}
        size={16}
        color={isError ? colors.danger : colors.brandDark}
      />
      <Text style={[styles.statusText, { color: isError ? colors.danger : colors.brandDark }]}>
        {status.message}
      </Text>
    </View>
  );
}

export function NavCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.navCard} onPress={onPress} accessibilityRole="button">
      <View style={styles.navIcon}>
        <Icon name={icon} size={20} color={colors.brandDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.navTitle}>{title}</Text>
        <Text style={styles.hint}>{description}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textFaint} />
    </TouchableOpacity>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

/** "1.234,56", "8,99" ou "8.99" → número; NaN se inválido. */
export function parseDecimal(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') return NaN;
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  return Number(normalized);
}

export function formatDecimalInput(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surfaceAlt },
  topBar: {
    backgroundColor: colors.surfaceDark,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  topBarInner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  brand: { color: '#fff', ...typography.bodyStrong },
  scroll: { padding: spacing.lg },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: spacing.lg },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { ...typography.bodyStrong, color: colors.brandDark },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.md },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { ...typography.h2, color: colors.text },
  sectionDescription: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fieldCell: { flexGrow: 1, flexBasis: 220 },
  field: { gap: 6 },
  label: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    color: colors.text,
    ...typography.body,
  },
  inputError: { borderColor: colors.danger },
  inputDisabled: { backgroundColor: colors.surfaceSunken, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.textMuted },
  errorText: { ...typography.caption, color: colors.danger },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
  },
  segment: {
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    alignItems: 'center',
  },
  segmentSelected: { backgroundColor: colors.surface },
  segmentText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  segmentTextSelected: { color: colors.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleLabel: { ...typography.bodyStrong, color: colors.text },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  statusSuccess: { backgroundColor: colors.brandSoft },
  statusError: { backgroundColor: colors.dangerSoft },
  statusText: { ...typography.caption, fontWeight: '600', flex: 1 },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexGrow: 1,
    flexBasis: 280,
  },
  navIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { ...typography.bodyStrong, color: colors.text },
  loading: { padding: spacing.xxl, alignItems: 'center' },
});
