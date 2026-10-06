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
import { ApiError, apiRequest, isApiConfigured } from '../services/api';

const STORAGE_KEY = 'scanmercado:auth:v1';
const TOKEN_KEY = 'scanmercado:customer-token:v1';

type PublicUser = Omit<User, 'password'>;
type LoginResult = { status: 'ok' } | { status: 'invalid_credentials'; message?: string };

type AuthContextValue = {
  user: PublicUser | null;
  isReady: boolean;
  login: (cpf: string, password: string) => Promise<LoginResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type ApiCustomer = { id: string; name: string; cpf: string | null; points: number };

function fromApi(customer: ApiCustomer): PublicUser {
  return { id: customer.id, name: customer.name, cpf: customer.cpf ?? '', points: customer.points };
}

function toPublicUser(user: User): PublicUser {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

/**
 * Login do cliente do app (CPF + senha). Com a API configurada, o login é
 * de verdade (senha conferida no servidor); sem ela, usa os usuários de
 * demonstração de src/data/users.ts.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [rawUser, savedToken] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(TOKEN_KEY),
        ]);
        if (rawUser) setUser(JSON.parse(rawUser));
        if (savedToken) setToken(savedToken);

        // Atualiza pontos/nome e descobre se a sessão foi encerrada no servidor.
        if (isApiConfigured && savedToken) {
          try {
            const me = fromApi(await apiRequest<ApiCustomer>('/auth/me', { auth: savedToken }));
            setUser(me);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(me));
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
              setUser(null);
              setToken(null);
              await AsyncStorage.multiRemove([STORAGE_KEY, TOKEN_KEY]);
            }
          }
        }
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const login = useCallback(async (cpf: string, password: string): Promise<LoginResult> => {
    const cleanCpf = cpf.replace(/\D/g, '');

    if (isApiConfigured) {
      try {
        const result = await apiRequest<{ token: string; user: ApiCustomer }>('/auth/customer/login', {
          method: 'POST',
          tenant: true,
          body: { cpf: cleanCpf, password },
        });
        const publicUser = fromApi(result.user);
        setUser(publicUser);
        setToken(result.token);
        await AsyncStorage.multiSet([
          [STORAGE_KEY, JSON.stringify(publicUser)],
          [TOKEN_KEY, result.token],
        ]);
        return { status: 'ok' };
      } catch (err) {
        return { status: 'invalid_credentials', message: err instanceof Error ? err.message : undefined };
      }
    }

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
    if (isApiConfigured && token) {
      apiRequest('/auth/logout', { method: 'POST', auth: token }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    AsyncStorage.multiRemove([STORAGE_KEY, TOKEN_KEY]).catch(() => {});
  }, [token]);

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
