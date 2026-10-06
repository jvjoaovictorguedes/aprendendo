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

import { INITIAL_NOTIFICATIONS, NotificationItem, NotificationKind } from '../data/notifications';

const STORAGE_KEY = 'scanmercado:notifications:v1';
const PUSH_ENABLED_KEY = 'scanmercado:push-enabled:v1';

// expo-notifications derruba o app no Expo Go (Android, a partir da SDK 53,
// e também no iOS para push remoto) com um throw síncrono ao ser carregado.
// Por isso nunca importamos o pacote no topo do arquivo: carregamos sob
// demanda (só quando o cliente liga o push) e qualquer falha — Expo Go,
// permissão negada, o que for — cai graciosamente para "push indisponível",
// sem derrubar o app. O centro de notificações in-app funciona sempre,
// independente disso.
type NotificationsModule = typeof import('expo-notifications');

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;

function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (!notificationsModulePromise) {
    notificationsModulePromise = (async () => {
      try {
        const mod: NotificationsModule = await import('expo-notifications');
        mod.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
        return mod;
      } catch {
        return null;
      }
    })();
  }
  return notificationsModulePromise;
}

type NotificationsContextValue = {
  notifications: NotificationItem[];
  unreadCount: number;
  pushEnabled: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  notify: (input: { title: string; body: string; kind: NotificationKind }) => void;
  setPushEnabled: (value: boolean) => Promise<boolean>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: PropsWithChildren) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pushEnabled, setPushEnabledState] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(PUSH_ENABLED_KEY),
    ])
      .then(([rawNotifications, rawPushEnabled]) => {
        setNotifications(rawNotifications ? JSON.parse(rawNotifications) : INITIAL_NOTIFICATIONS);
        setPushEnabledState(rawPushEnabled ? JSON.parse(rawPushEnabled) : false);
      })
      .finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications)).catch(() => {});
  }, [notifications, isLoaded]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, []);

  const notify = useCallback(
    ({ title, body, kind }: { title: string; body: string; kind: NotificationKind }) => {
      const item: NotificationItem = {
        id: `n_${Date.now()}`,
        title,
        body,
        kind,
        read: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((current) => [item, ...current]);

      if (pushEnabled) {
        loadNotificationsModule()
          .then((mod) => {
            if (!mod) return;
            return mod.getPermissionsAsync().then((permission) => {
              if (!permission.granted) return;
              return mod.scheduleNotificationAsync({ content: { title, body }, trigger: null });
            });
          })
          .catch(() => {});
      }
    },
    [pushEnabled],
  );

  const setPushEnabled = useCallback(async (value: boolean) => {
    if (!value) {
      setPushEnabledState(false);
      AsyncStorage.setItem(PUSH_ENABLED_KEY, JSON.stringify(false)).catch(() => {});
      return true;
    }

    const mod = await loadNotificationsModule();
    if (!mod) {
      setPushEnabledState(false);
      AsyncStorage.setItem(PUSH_ENABLED_KEY, JSON.stringify(false)).catch(() => {});
      return false;
    }

    try {
      const { granted } = await mod.requestPermissionsAsync();
      setPushEnabledState(granted);
      AsyncStorage.setItem(PUSH_ENABLED_KEY, JSON.stringify(granted)).catch(() => {});
      return granted;
    } catch {
      setPushEnabledState(false);
      return false;
    }
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      pushEnabled,
      markAsRead,
      markAllAsRead,
      notify,
      setPushEnabled,
    }),
    [notifications, unreadCount, pushEnabled, markAsRead, markAllAsRead, notify, setPushEnabled],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications deve ser usado dentro de um NotificationsProvider');
  }
  return context;
}
