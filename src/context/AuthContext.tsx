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

import { findUserByCpf, User } from '../data/users';

const STORAGE_KEY = 'scanmercado:auth:v1';

type PublicUser = Omit<User, 'password'>;
type LoginResult = { status: 'ok' } | { status: 'invalid_credentials' };

type AuthContextValue = {
  user: PublicUser | null;
  isReady: boolean;
  login: (cpf: string, password: string) => Promise<LoginResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toPublicUser(user: User): PublicUser {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setUser(JSON.parse(raw));
      })
      .finally(() => setIsReady(true));
  }, []);

  const login = useCallback(async (cpf: string, password: string): Promise<LoginResult> => {
    const cleanCpf = cpf.replace(/\D/g, '');
    const found = findUserByCpf(cleanCpf);

    if (!found || found.password !== password) {
      return { status: 'invalid_credentials' };
    }

    const publicUser = toPublicUser(found);
    setUser(publicUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(publicUser));
    return { status: 'ok' };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isReady, login, logout }),
    [user, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
