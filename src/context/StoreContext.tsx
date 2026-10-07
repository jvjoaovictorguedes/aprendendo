import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  PropsWithChildren,
} from 'react';
import { listStores, Store } from '../services/offers';
import { appTenantId, isApiConfigured } from '../services/api';
import { STORES } from '../data/stores';
const Context = createContext<{
  stores: Store[];
  selectedStore: Store | null;
  storeId: string | null;
  loading: boolean;
  error: string | null;
  selectStore: (id: string | null) => void;
  reload: () => Promise<void>;
} | null>(null);
const key = `scanmercado:store:${appTenantId ?? 'demo'}`;
export function StoreProvider({ children }: PropsWithChildren) {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = isApiConfigured
        ? await listStores()
        : STORES.map((s) => ({ ...s, active: true }));
      setStores(next);
      setStoreId((current) => (current && next.some((s) => s.id === current) ? current : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar as lojas.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((value) => {
        if (!cancelled) setStoreId(value);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) void reload();
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);
  const selectStore = useCallback((id: string | null) => {
    setStoreId(id);
    if (id) AsyncStorage.setItem(key, id).catch(() => {});
    else AsyncStorage.removeItem(key).catch(() => {});
  }, []);
  return (
    <Context.Provider
      value={{
        stores,
        storeId,
        selectedStore: stores.find((s) => s.id === storeId) ?? null,
        loading,
        error,
        selectStore,
        reload,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const c = useContext(Context);
  if (!c) throw new Error('StoreProvider necessário');
  return c;
}
