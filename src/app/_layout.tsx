import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../context/AuthContext';
import { CartProvider, useCart } from '../context/CartContext';
import { PromotionsProvider } from '../context/PromotionsContext';

const TAB_ICON_SIZE = 24;

function TabIcon({ emoji, showBadge }: { emoji: string; showBadge?: boolean }) {
  return (
    <View
      style={{
        width: TAB_ICON_SIZE,
        height: TAB_ICON_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 20, lineHeight: 24, textAlign: 'center' }}>{emoji}</Text>
      {showBadge ? <CartBadge /> : null}
    </View>
  );
}

function CartBadge() {
  const { items } = useCart();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  if (count === 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -4,
        right: -10,
        backgroundColor: '#C0392B',
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 12 }}>
        {count}
      </Text>
    </View>
  );
}

function RootNavigator() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#1DB954' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#1DB954',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scanner',
          tabBarLabel: 'Escanear',
          tabBarIcon: () => <TabIcon emoji="📷" />,
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          title: 'Promoções',
          tabBarLabel: 'Promoções',
          tabBarIcon: () => <TabIcon emoji="🏷" />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Meu Carrinho',
          tabBarLabel: 'Carrinho',
          tabBarIcon: () => <TabIcon emoji="🛒" showBadge />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarLabel: 'Perfil',
          tabBarIcon: () => <TabIcon emoji="👤" />,
        }}
      />
    </Tabs>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <PromotionsProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </PromotionsProvider>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
