import { demoStorageKey } from '../services/demo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';

import { isApiConfigured } from '../services/api';
import {
  DEFAULT_TENANT_SETTINGS,
  fetchAppTenantSettings,
  TenantSettings,
} from '../services/tenantSettings';

const STORAGE_KEY = demoStorageKey('scanmercado:tenant-settings:v1');

const RefreshContext = createContext<() => Promise<void>>(async () => {});

const TenantSettingsContext = createContext<TenantSettings>(DEFAULT_TENANT_SETTINGS);

/**
 * Configuração da franquia deste build do app. Começa pelo padrão, troca
 * pela última cópia salva no aparelho e depois pela versão da API —
 * assim o scanner funciona mesmo sem internet.
 */
export function TenantSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<TenantSettings>(DEFAULT_TENANT_SETTINGS);

  const refresh = useCallback(async () => {
    if (!isApiConfigured) return;
    const remote = await fetchAppTenantSettings();
    setSettings(remote);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
  }, []);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw && !cancelled) setSettings(JSON.parse(raw));
      })
      .catch(() => {});

    if (isApiConfigured) {
      fetchAppTenantSettings()
        .then((remote) => {
          if (cancelled) return;
          setSettings(remote);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remote)).catch(() => {});
        })
        .catch((err) => console.warn('Não foi possível carregar a configuração da franquia:', err));
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RefreshContext.Provider value={refresh}>
      <TenantSettingsContext.Provider value={settings}>{children}</TenantSettingsContext.Provider>
    </RefreshContext.Provider>
  );
}

export function useTenantSettings(): TenantSettings {
  return useContext(TenantSettingsContext);
}

export const useRefreshTenantSettings = () => useContext(RefreshContext);
