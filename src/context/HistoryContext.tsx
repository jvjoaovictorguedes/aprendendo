import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { CartItem, Purchase } from '../types';

const STORAGE_KEY = 'scanmercado:history:v1';

type HistoryContextValue = {
  purchases: Purchase[];
  addPurchase: (items: CartItem[], totals: { originalTotal: number; finalTotal: number; savings: number }) => Purchase;
};

const HistoryContext = createContext<HistoryContextValue | undefined>(undefined);

export function HistoryProvider({ children }: PropsWithChildren) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const saved = raw ? JSON.parse(raw) : null;
        if (Array.isArray(saved)) setPurchases(saved);
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(purchases)).catch(() => {});
  }, [purchases, isLoaded]);

  const addPurchase = useCallback(
    (items: CartItem[], totals: { originalTotal: number; finalTotal: number; savings: number }) => {
      const purchase: Purchase = {
        id: `p_${Date.now()}`,
        date: new Date().toISOString(),
        items,
        ...totals,
      };
      setPurchases((current) => [purchase, ...current]);
      return purchase;
    },
    [],
  );

  const value = useMemo<HistoryContextValue>(
    () => ({ purchases, addPurchase }),
    [purchases, addPurchase],
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryContextValue {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory deve ser usado dentro de um HistoryProvider');
  }
  return context;
}
