import { Tabs } from 'expo-router';
import { StyleSheet, Text, View, useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../components/ui';
import { useCart } from '../../context/CartContext';
import { colors, radius } from '../../theme/tokens';

function ScanTabIcon() {
  const { items } = useCart();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <View style={styles.scanner}>
      <Icon name="camera" size={23} color={colors.onBrand} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} allowFontScaling={false}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TabLabel({ label, color }: { label: string; color: ColorValue }) {
  return (
    <Text style={[styles.label, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const labelExtra = Math.ceil(16 * (Math.min(Math.max(fontScale, 1), 1.2) - 1));
  return (
    <Tabs
      screenOptions={{
        // Cada tela desenha o próprio cabeçalho (ScreenHeader), no mesmo padrão.
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelPosition: 'below-icon',
        tabBarLabel: ({ children, color }) => <TabLabel label={children} color={color} />,
        tabBarIconStyle: { height: 40 },
        tabBarItemStyle: { flex: 1, minWidth: 0 },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          // Includes the navigator's internal 5px padding above and below each item.
          height: 80 + labelExtra + insets.bottom,
          paddingTop: 6,
          paddingBottom: 6 + insets.bottom,
          borderTopWidth: 0,
          borderTopLeftRadius: radius.xxl,
          borderTopRightRadius: radius.xxl,
          backgroundColor: colors.surface,
          boxShadow: '0 -3px 12px rgba(10, 12, 14, 0.08)',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <Icon name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          title: 'Ofertas',
          tabBarIcon: ({ color }) => <Icon name="percent" size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="comprar"
        options={{
          title: 'Comprar',
          tabBarAccessibilityLabel: 'Escanear produtos',
          tabBarIcon: () => <ScanTabIcon />,
        }}
      />
      <Tabs.Screen
        name="listas"
        options={{
          title: 'Listas',
          tabBarLabel: ({ color }) => <TabLabel label="Listas" color={color} />,
          tabBarIcon: ({ color }) => <Icon name="list" size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Conta',
          tabBarIcon: ({ color }) => <Icon name="user" size={22} color={color} />,
        }}
      />
      {/* Rotas acessíveis por navegação, mas fora da barra de abas */}
      <Tabs.Screen name="cart" options={{ title: 'Carrinho', href: null }} />
      <Tabs.Screen name="historico" options={{ title: 'Histórico', href: null }} />
      <Tabs.Screen name="lojas" options={{ title: 'Lojas', href: null }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notificações', href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, lineHeight: 16, fontWeight: '700', textAlign: 'center', flexShrink: 0 },
  scanner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700', lineHeight: 12 },
});
