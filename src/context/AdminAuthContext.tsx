import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AdminProfile, describeError, fetchMyProfile } from '../services/admin';
import { supabase } from '../services/supabase';

type AdminAuthContextValue = {
  isReady: boolean;
  session: Session | null;
  profile: AdminProfile | null;
  isPlatformAdmin: boolean;
  /** Retorna a mensagem de erro, ou null se entrou. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
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

/** Login do painel admin — Supabase Auth de verdade (e-mail + senha). */
export function AdminAuthProvider({ children }: PropsWithChildren) {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  // De qual usuário é o profile carregado — evita mostrar "sem acesso"
  // enquanto o profile de quem acabou de entrar ainda está chegando.
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    const client = supabase;
    client.auth.getSession().then(async ({ data }) => {
      let current = data.session;
      // Modo de teste: em desenvolvimento, entra sozinho com a conta do .env
      // e o painel abre sem tela de login. Build de produção nunca faz isso.
      if (!current && DEV_AUTO_LOGIN) {
        const { data: signed, error } = await client.auth.signInWithPassword(DEV_AUTO_LOGIN);
        if (error) console.warn('Login automático de desenvolvimento falhou:', error.message);
        current = signed.session;
      }
      setSession(current);
      setSessionChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMyProfile(userId)
      .catch(() => null)
      .then((result) => {
        if (cancelled) return;
        setProfile(result);
        setProfileUserId(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isReady = !supabase || (sessionChecked && (userId === null || profileUserId === userId));
  const currentProfile = userId && profileUserId === userId ? profile : null;

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Supabase não configurado no .env.';
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return null;
    if (error.message.toLowerCase().includes('invalid login')) return 'E-mail ou senha incorretos.';
    return describeError(error);
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      isReady,
      session,
      profile: currentProfile,
      isPlatformAdmin: currentProfile?.role === 'platform_admin',
      signIn,
      signOut,
    }),
    [isReady, session, currentProfile, signIn, signOut],
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
