import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useStore } from '../context/StoreContext';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { Icon } from './ui';

/** Loja selecionada — mesmo cartão em Início, Ofertas, Carrinho e Comprar. */
export function StoreSelector({ compact }: { compact?: boolean }) {
  const { selectedStore, error } = useStore();
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/lojas')}
      accessibilityRole="button"
      accessibilityLabel={`Loja: ${selectedStore?.name ?? 'toda a rede'}. Trocar loja`}
      style={[styles.card, compact && styles.compact]}
    >
      <View style={styles.iconWrap}>
        <Icon name="map-pin" size={17} color={colors.brandDark} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{error ? 'Lojas indisponíveis' : 'Sua loja'}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {error
            ? 'Toque para tentar novamente'
            : (selectedStore?.name ?? 'Toda a rede — escolher loja')}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textFaint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  compact: { borderRadius: 0, borderWidth: 0, borderBottomWidth: 1 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  label: { ...typography.small, color: colors.textMuted },
  name: { ...typography.bodyStrong, color: colors.text, marginTop: 1 },
});
