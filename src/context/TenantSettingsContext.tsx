import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';

import { appTenantId, isApiConfigured } from '../services/api';
import {
  DEFAULT_TENANT_SETTINGS,
  fetchAppTenantSettings,
  TenantSettings,
} from '../services/tenantSettings';

const STORAGE_KEY = `scanmercado:tenant-settings:${appTenantId ?? 'demo'}:v1`;

const TenantSettingsContext = createContext<TenantSettings>(DEFAULT_TENANT_SETTINGS);

/**
 * Configuração da franquia deste build do app. Começa pelo padrão, troca
 * pela última cópia salva no aparelho e depois pela versão da API —
 * assim o scanner funciona mesmo sem internet.
 */
export function TenantSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<TenantSettings>(DEFAULT_TENANT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    // A cópia salva só vale enquanto a versão da API não chegou — a leitura
    // do aparelho pode terminar depois e não pode sobrescrever a mais nova.
    let hasRemote = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw && !cancelled && !hasRemote) setSettings(JSON.parse(raw));
      })
      .catch(() => {});

    if (isApiConfigured) {
      fetchAppTenantSettings()
        .then((remote) => {
          if (cancelled) return;
          hasRemote = true;
          setSettings(remote);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remote)).catch(() => {});
        })
        .catch((err) => console.warn('Não foi possível carregar a configuração da franquia:', err));
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return <TenantSettingsContext.Provider value={settings}>{children}</TenantSettingsContext.Provider>;
}

export function useTenantSettings(): TenantSettings {
  return useContext(TenantSettingsContext);
}
