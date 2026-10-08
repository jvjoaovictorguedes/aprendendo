import { demoStorageKey } from './demo';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiRequest, isApiConfigured, resolveAssetUrl } from './api';

export type AppBrand = {
  name: string;
  accentColor: string;
  logoUrl: string | null;
};

const STORAGE_KEY = demoStorageKey('scanmercado:brand:v1');
// Primeira abertura (sem cache): espera a marca no máximo isso antes de abrir
// com a marca padrão — o app nunca fica preso numa tela vazia.
const FIRST_LOAD_TIMEOUT_MS = 2500;

async function readCachedBrand(): Promise<AppBrand | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppBrand) : null;
  } catch {
    return null;
  }
}

function refreshCache(): Promise<AppBrand | null> {
  if (!isApiConfigured) return Promise.resolve(null);
  return apiRequest<AppBrand>('/public/brand', { tenant: true })
    .then((remote) => {
      remote = { ...remote, logoUrl: resolveAssetUrl(remote.logoUrl) };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remote)).catch(() => {});
      return remote;
    })
    .catch((err) => {
      console.warn('Não foi possível carregar a marca da franquia:', err);
      return null;
    });
}

/**
 * Marca a aplicar na abertura do app. Com cache: usa o cache na hora e
 * atualiza em segundo plano (vale na próxima abertura). Sem cache: espera a
 * API por pouco tempo.
 */
export async function loadBrand(): Promise<AppBrand | null> {
  const cached = await readCachedBrand();
  const refresh = refreshCache();
  if (cached) return cached;

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), FIRST_LOAD_TIMEOUT_MS),
  );
  return Promise.race([refresh, timeout]);
}
