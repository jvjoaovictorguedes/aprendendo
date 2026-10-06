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

import { AdminProfile, describeError } from '../services/admin';
import { ApiError, apiRequest, isApiAvailable, setAdminToken } from '../services/api';

const STORAGE_KEY = 'scanmercado:admin-token:v1';

type AdminAuthContextValue = {
  isReady: boolean;
  profile: AdminProfile | null;
  isPlatformAdmin: boolean;
  /** Retorna a mensagem de erro, ou null se entrou. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Retorna a mensagem de erro, ou null se trocou. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

// Só em desenvolvimento (npx expo start). Nunca preencha isso no ambiente
// de build (EAS) — variáveis EXPO_PUBLIC_ vão para dentro do app.
const DEV_AUTO_LOGIN =
  __DEV__ && process.env.EXPO_PUBLIC_ADMIN_DEV_EMAIL && process.env.EXPO_PUBLIC_ADMIN_DEV_PASSWORD
    ? {
        email: process.env.EXPO_PUBLIC_ADMIN_DEV_EMAIL,
        password: process.env.EXPO_PUBLIC_ADMIN_DEV_PASSWORD,
      }
    : null;

type LoginResponse = { token: string; user: AdminProfile };

async function storeToken(token: string | null) {
  setAdminToken(token);
  try {
    if (token) await AsyncStorage.setItem(STORAGE_KEY, token);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem armazenamento (modo privado do navegador): fica só nesta sessão.
  }
}

/** Login do painel admin pela API (e-mail + senha). */
export function AdminAuthProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(!isApiAvailable);
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  useEffect(() => {
    if (!isApiAvailable) return;
    let cancelled = false;

    (async () => {
      let saved: string | null = null;
      try {
        saved = await AsyncStorage.getItem(STORAGE_KEY);
      } catch {
        saved = null;
      }

      let current: AdminProfile | null = null;
      if (saved) {
        setAdminToken(saved);
        try {
          current = await apiRequest<AdminProfile>('/auth/me', { auth: 'admin' });
        } catch (err) {
          // Token vencido/revogado: descarta. Erro de rede: mantém para tentar depois.
          if (err instanceof ApiError && err.status === 401) await storeToken(null);
        }
      }

      // Modo de teste: em desenvolvimento, entra sozinho com a conta do .env.
      if (!current && DEV_AUTO_LOGIN) {
        try {
          const login = await apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: DEV_AUTO_LOGIN });
          await storeToken(login.token);
          current = login.user;
        } catch (err) {
          console.warn('Login automático de desenvolvimento falhou:', describeError(err));
        }
      }

      if (!cancelled) {
        setProfile(current);
        setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const login = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      await storeToken(login.token);
      setProfile(login.user);
      return null;
    } catch (err) {
      return describeError(err);
    }
  }, []);

  const signOut = useCallback(async () => {
    await apiRequest('/auth/logout', { method: 'POST', auth: 'admin' }).catch(() => {});
    await storeToken(null);
    setProfile(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        auth: 'admin',
        body: { currentPassword, newPassword },
      });
      setProfile(await apiRequest<AdminProfile>('/auth/me', { auth: 'admin' }));
      return null;
    } catch (err) {
      return describeError(err);
    }
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      isReady,
      profile,
      isPlatformAdmin: profile?.role === 'platform_admin',
      signIn,
      signOut,
      changePassword,
    }),
    [isReady, profile, signIn, signOut, changePassword],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth deve ser usado dentro de um AdminAuthProvider');
  }
  return context;
}
