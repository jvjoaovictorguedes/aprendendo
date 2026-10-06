import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../context/AuthContext';
import { BudgetProvider } from '../context/BudgetContext';
import { CartProvider } from '../context/CartContext';
import { FavoritesProvider } from '../context/FavoritesContext';
import { HistoryProvider } from '../context/HistoryContext';
import { ListsProvider } from '../context/ListsContext';
import { NotificationsProvider } from '../context/NotificationsContext';
import { PromotionsProvider } from '../context/PromotionsContext';
import { TenantSettingsProvider } from '../context/TenantSettingsContext';

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TenantSettingsProvider>
          <AuthProvider>
            <CartProvider>
              <PromotionsProvider>
                <ListsProvider>
                  <HistoryProvider>
                    <BudgetProvider>
                      <FavoritesProvider>
                        <NotificationsProvider>
                          <StatusBar style="light" />
                          <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="(tabs)" />
                            {/* Painel do lojista / plataforma — mobile e web */}
                            <Stack.Screen name="admin" />
                          </Stack>
                        </NotificationsProvider>
                      </FavoritesProvider>
                    </BudgetProvider>
                  </HistoryProvider>
                </ListsProvider>
              </PromotionsProvider>
            </CartProvider>
          </AuthProvider>
        </TenantSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
