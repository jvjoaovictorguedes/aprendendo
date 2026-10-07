import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Button } from './Button';
import { Icon } from './Icon';

type Tone = 'error' | 'warning' | 'info' | 'success';

type Props = {
  tone?: Tone;
  message: string;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const TONES: Record<Tone, { bg: string; fg: string; icon: Parameters<typeof Icon>[0]['name'] }> = {
  error: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' },
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'alert-triangle' },
  info: { bg: colors.surfaceSunken, fg: colors.textMuted, icon: 'info' },
  success: { bg: colors.brandSoft, fg: colors.brandDark, icon: 'check-circle' },
};

/** Aviso dentro da tela — mesmo visual para erro, alerta, informação e sucesso. */
export function Notice({ tone = 'info', message, title, actionLabel, onAction }: Props) {
  const palette = TONES[tone];
  return (
    <View
      style={[styles.box, { backgroundColor: palette.bg }]}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
    >
      <Icon name={palette.icon} size={18} color={palette.fg} />
      <View style={styles.body}>
        {title ? <Text style={[styles.title, { color: palette.fg }]}>{title}</Text> : null}
        <Text style={[styles.message, { color: tone === 'info' ? colors.text : palette.fg }]}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Button
            label={actionLabel}
            variant="ghost"
            onPress={onAction}
            style={styles.action}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  body: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong },
  message: { ...typography.caption },
  action: { alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 32, paddingVertical: 4 },
});
