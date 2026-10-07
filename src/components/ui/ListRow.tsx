import { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, minTouchSize, radius, spacing, typography } from '../../theme/tokens';
import { Icon } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  icon?: Parameters<typeof Icon>[0]['name'];
  /** Conteúdo à direita; sem ele, linhas tocáveis mostram a seta. */
  right?: ReactNode;
  /** Ação independente, fora do botão que abre a linha. */
  rightAction?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  /** Linha divisória acima (para listas dentro de um Card sem padding). */
  divider?: boolean;
  accessibilityLabel?: string;
};

/** Linha de lista/menu padrão: ícone, título, subtítulo e ação à direita. */
export function ListRow({
  title,
  subtitle,
  icon,
  right,
  rightAction,
  onPress,
  danger,
  divider,
  accessibilityLabel,
}: Props) {
  const mainContent = (
    <>
      {icon ? (
        <View style={[styles.iconWrap, danger && { backgroundColor: colors.dangerSoft }]}>
          <Icon name={icon} size={18} color={danger ? colors.danger : colors.brandDark} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.title, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </>
  );
  const style = [styles.row, divider && styles.divider];
  if (rightAction) {
    return (
      <View style={[style, styles.actionRow]}>
        {onPress ? (
          <TouchableOpacity
            style={styles.mainAction}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? title}
          >
            {mainContent}
          </TouchableOpacity>
        ) : (
          <View style={styles.mainAction}>{mainContent}</View>
        )}
        {rightAction}
      </View>
    );
  }
  const content = (
    <>
      {mainContent}
      {right ??
        (onPress && !danger ? (
          <Icon name="chevron-right" size={18} color={colors.textFaint} />
        ) : null)}
    </>
  );
  return onPress ? (
    <TouchableOpacity
      style={style}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {content}
    </TouchableOpacity>
  ) : (
    <View style={style}>{content}</View>
  );
}

const styles = StyleSheet.create({
  actionRow: { paddingVertical: 0 },
  mainAction: {
    flex: 1,
    minHeight: minTouchSize + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  row: {
    minHeight: minTouchSize + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { ...typography.bodyStrong, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
