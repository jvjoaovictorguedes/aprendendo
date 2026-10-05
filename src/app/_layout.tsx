import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../context/AuthContext';
import { BudgetProvider } from '../context/BudgetContext';
import { CartProvider, useCart } from '../context/CartContext';
import { FavoritesProvider } from '../context/FavoritesContext';
import { HistoryProvider } from '../context/HistoryContext';
import { ListsProvider } from '../context/ListsContext';
import { PromotionsProvider } from '../context/PromotionsContext';
import { colors } from '../theme/tokens';

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
        backgroundColor: colors.danger,
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
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.brand,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ScanMercado',
          tabBarLabel: 'Home',
          tabBarIcon: () => <TabIcon emoji="🏠" />,
        }}
      />
      <Tabs.Screen
        name="comprar"
        options={{
          title: 'Comprar',
          tabBarLabel: 'Comprar',
          tabBarIcon: () => <TabIcon emoji="📷" showBadge />,
        }}
      />
      <Tabs.Screen
        name="listas"
        options={{
          title: 'Minhas Listas',
          tabBarLabel: 'Listas',
          tabBarIcon: () => <TabIcon emoji="📝" />,
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarLabel: 'Histórico',
          tabBarIcon: () => <TabIcon emoji="🧾" />,
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
      {/* Rotas acessíveis por navegação, mas fora da barra de abas */}
      <Tabs.Screen name="cart" options={{ title: 'Meu Carrinho', href: null }} />
      <Tabs.Screen name="promotions" options={{ title: 'Promoções', href: null }} />
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
              <ListsProvider>
                <HistoryProvider>
                  <BudgetProvider>
                    <FavoritesProvider>
                      <StatusBar style="light" />
                      <RootNavigator />
                    </FavoritesProvider>
                  </BudgetProvider>
                </HistoryProvider>
              </ListsProvider>
            </PromotionsProvider>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
