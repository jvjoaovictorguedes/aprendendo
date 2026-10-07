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

const STORAGE_KEY = 'scanmercado:budget-limit:v1';

type BudgetContextValue = {
  limit: number | null;
  setLimit: (value: number | null) => void;
};

const BudgetContext = createContext<BudgetContextValue | undefined>(undefined);

export function BudgetProvider({ children }: PropsWithChildren) {
  const [limit, setLimitState] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const saved = raw ? JSON.parse(raw) : null;
        if (typeof saved === 'number' && saved > 0) setLimitState(saved);
      })
      .catch(() => {});
  }, []);

  const setLimit = useCallback((value: number | null) => {
    setLimitState(value);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value)).catch(() => {});
  }, []);

  const value = useMemo<BudgetContextValue>(() => ({ limit, setLimit }), [limit, setLimit]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget(): BudgetContextValue {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget deve ser usado dentro de um BudgetProvider');
  }
  return context;
}
