import { useRouter } from 'expo-router';
import { PropsWithChildren, ReactElement, ReactNode } from 'react';
import {
  RefreshControlProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, hitSlop, spacing, typography } from '../../theme/tokens';
import { Icon } from './Icon';

type ScreenProps = PropsWithChildren<{
  /** Cabeçalho fixo no topo (fora da rolagem). */
  header?: ReactNode;
  /** Barra fixa no rodapé (ex.: resumo do carrinho, campo de adicionar). */
  footer?: ReactNode;
  /** false = o filho controla a própria rolagem (ex.: FlatList). */
  scroll?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

/**
 * Estrutura padrão de toda tela do app: fundo, respiro da barra de status,
 * margens laterais e espaçamento entre blocos iguais em todas as telas.
 */
export function Screen({
  header,
  footer,
  scroll = true,
  refreshControl,
  contentStyle,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

type HeaderProps = {
  title: string;
  subtitle?: string;
  /** Mostra a seta de voltar. Sem histórico, volta para o Início. */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, back, onBack, right }: HeaderProps) {
  const router = useRouter();
  const goBack =
    onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.header}>
      {back || onBack ? (
        <TouchableOpacity
          onPress={goBack}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={styles.backButton}
        >
          <Icon name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.flex}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

/** Botão redondo de ícone usado no canto do cabeçalho (sino, ações). */
export function HeaderIconButton({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onPress: () => void;
  badge?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.iconButton}
    >
      <Icon name={icon} size={19} color={colors.text} />
      {badge ? <View style={styles.iconBadge} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceAlt },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    position: 'absolute',
    top: 4,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
