import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CartProvider, useCart } from '../context/CartContext';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

function CartBadge() {
  const { items } = useCart();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  if (count === 0) return null;
  return (
    <Text
      style={{
        position: 'absolute',
        top: -4,
        right: -10,
        backgroundColor: '#C0392B',
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        textAlign: 'center',
        lineHeight: 16,
        paddingHorizontal: 2,
      }}
    >
      {count}
    </Text>
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
        name="cart"
        options={{
          title: 'Meu Carrinho',
          tabBarLabel: 'Carrinho',
          tabBarIcon: () => (
            <>
              <TabIcon emoji="🛒" />
              <CartBadge />
            </>
          ),
        }}
      />
    </Tabs>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CartProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </CartProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
