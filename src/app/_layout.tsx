import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureResponderEvent, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Icon } from '../components/ui';
import { AuthProvider } from '../context/AuthContext';
import { BudgetProvider } from '../context/BudgetContext';
import { CartProvider, useCart } from '../context/CartContext';
import { FavoritesProvider } from '../context/FavoritesContext';
import { HistoryProvider } from '../context/HistoryContext';
import { ListsProvider } from '../context/ListsContext';
import { NotificationsProvider } from '../context/NotificationsContext';
import { PromotionsProvider } from '../context/PromotionsContext';
import { colors, radius } from '../theme/tokens';

function ScanTabButton({ onPress }: { onPress?: (event: GestureResponderEvent) => void }) {
  const { items } = useCart();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Escanear produtos"
      style={{
        top: -22,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: colors.brand,
        borderWidth: 4,
        borderColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        shadowColor: colors.brandDark,
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <Icon name="camera" size={24} color={colors.onBrand} />
      {count > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.danger,
            borderWidth: 2,
            borderColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 2,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 12 }}>
            {count}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
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
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700' },
        tabBarStyle: {
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopWidth: 0,
          borderTopLeftRadius: radius.xxl,
          borderTopRightRadius: radius.xxl,
          backgroundColor: colors.surface,
          shadowColor: '#0A0C0E',
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          elevation: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          headerShown: false,
          tabBarLabel: 'Início',
          tabBarIcon: ({ color }) => <Icon name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          title: 'Ofertas',
          headerShown: false,
          tabBarLabel: 'Ofertas',
          tabBarIcon: ({ color }) => <Icon name="percent" size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="comprar"
        options={{
          title: 'Comprar',
          headerShown: false,
          tabBarLabel: () => null,
          tabBarButton: ScanTabButton,
        }}
      />
      <Tabs.Screen
        name="listas"
        options={{
          title: 'Minhas Listas',
          tabBarLabel: 'Listas',
          tabBarIcon: ({ color }) => <Icon name="list" size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Conta',
          headerShown: false,
          tabBarLabel: 'Conta',
          tabBarIcon: ({ color }) => <Icon name="user" size={22} color={color} />,
        }}
      />
      {/* Rotas acessíveis por navegação, mas fora da barra de abas */}
      <Tabs.Screen name="cart" options={{ title: 'Meu Carrinho', href: null }} />
      <Tabs.Screen name="historico" options={{ title: 'Histórico', href: null }} />
      <Tabs.Screen name="lojas" options={{ title: 'Lojas próximas', href: null }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notificações', href: null }} />
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
                      <NotificationsProvider>
                        <StatusBar style="light" />
                        <RootNavigator />
                      </NotificationsProvider>
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
