import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from './supabase';

export type AppBrand = { name: string; accentColor: string; logoUrl: string | null };

const STORAGE_KEY = 'scanmercado:brand:v1';
// Primeira abertura (sem cache): espera a marca no máximo isso antes de abrir
// com a marca padrão — o app nunca fica preso numa tela vazia.
const FIRST_LOAD_TIMEOUT_MS = 2500;

async function fetchRemoteBrand(): Promise<AppBrand | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('app_brand');
  if (error) throw error;
  const row = (data as { name: string; accent_color: string; logo_url: string | null }[] | null)?.[0];
  return row ? { name: row.name, accentColor: row.accent_color, logoUrl: row.logo_url } : null;
}

async function readCachedBrand(): Promise<AppBrand | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppBrand) : null;
  } catch {
    return null;
  }
}

function refreshCache(): Promise<AppBrand | null> {
  return fetchRemoteBrand()
    .then((remote) => {
      if (remote) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remote)).catch(() => {});
      return remote;
    })
    .catch((err) => {
      console.warn('Não foi possível carregar a marca da franquia:', err);
      return null;
    });
}

/**
 * Marca a aplicar na abertura do app. Com cache: usa o cache na hora e
 * atualiza em segundo plano (vale na próxima abertura). Sem cache: espera o
 * Supabase por pouco tempo.
 */
export async function loadBrand(): Promise<AppBrand | null> {
  const cached = await readCachedBrand();
  const refresh = refreshCache();
  if (cached) return cached;

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FIRST_LOAD_TIMEOUT_MS));
  return Promise.race([refresh, timeout]);
}
