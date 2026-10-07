import { Text, TouchableOpacity } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDemo } from '../context/DemoContext';
import { colors } from '../theme/tokens';
export function DemoBanner() {
  const info = useDemo(),
    router = useRouter(),
    path = usePathname(),
    insets = useSafeAreaInsets();
  if (!info.enabled || path.startsWith('/admin')) return null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Abrir apresentação de demonstração"
      onPress={() => router.push('/demonstracao')}
      style={{
        backgroundColor: colors.brandSoft,
        paddingTop: insets.top + 6,
        paddingBottom: 6,
        paddingHorizontal: 8,
        alignItems: 'center',
      }}
    >
      <Text
        style={{ fontSize: 12, color: colors.brandDark, fontWeight: '700', textAlign: 'center' }}
      >
        DEMONSTRAÇÃO · Dados fictícios · Ver apresentação
      </Text>
    </TouchableOpacity>
  );
}
