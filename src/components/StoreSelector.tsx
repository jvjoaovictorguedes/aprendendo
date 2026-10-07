import { useRouter } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';
import { useStore } from '../context/StoreContext';
import { colors, spacing, typography } from '../theme/tokens';
export function StoreSelector() {
  const { selectedStore, error } = useStore();
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/lojas')}
      accessibilityRole="button"
      style={{ padding: spacing.md, backgroundColor: colors.surfaceAlt }}
    >
      <Text style={{ ...typography.bodyStrong, color: colors.brandDark }}>
        {selectedStore?.name ?? 'Escolher loja'} ›
      </Text>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>
        {error
          ? 'Não foi possível carregar lojas. Toque para tentar novamente.'
          : selectedStore
            ? 'Ofertas e condições desta loja'
            : 'Você pode continuar com as ofertas válidas em todas as lojas.'}
      </Text>
    </TouchableOpacity>
  );
}
