import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { AppState } from 'react-native';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { INITIAL_NOTIFICATIONS, NotificationItem, NotificationKind } from '../data/notifications';
import { appTenantId, isApiConfigured } from '../services/api';
import {
  NotificationPreferences,
  NO_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  saveNotificationPreferences,
  getCustomerNotifications,
  readCustomerNotification,
  registerPushDevice,
  disablePushDevice,
  syncCustomerCart,
  recordCustomerPurchase,
  engagementItems,
} from '../services/engagement';
import { getPushRegistration, loadPushModule } from '../services/push';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import { useStore } from './StoreContext';

const newKey = () =>
  `cart-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
type Snapshot = Parameters<typeof syncCustomerCart>[1];
type Tracking = {
  cartKey: string;
  hadItems: boolean;
  fingerprint: string;
  revision: number;
  pending: Snapshot | null;
};
type Value = {
  notifications: NotificationItem[];
  unreadCount: number;
  pushEnabled: boolean;
  preferences: NotificationPreferences;
  pushError: string | null;
  busy: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  openNotification: (item: NotificationItem) => void;
  notify: (input: { title: string; body: string; kind: NotificationKind }) => void;
  setPushEnabled: (value: boolean) => Promise<boolean>;
  updatePreference: (kind: keyof NotificationPreferences, value: boolean) => Promise<void>;
  confirmPurchase: () => Promise<void>;
  refreshInbox: () => Promise<void>;
};
const Context = createContext<Value | null>(null);

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { token, user } = useAuth();
  const { items, isReady: cartReady } = useCart();
  const { storeId } = useStore();
  const scope = `scanmercado:notifications:${appTenantId ?? 'demo'}:${user?.id ?? 'guest'}:v2`;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pushEnabled, setEnabled] = useState(false);
  const [preferences, setPreferences] = useState(NO_NOTIFICATION_PREFERENCES);
  const [pushError, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const tracking = useRef<Tracking | null>(null);
  const installation = useRef('');
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const currentScope = useRef(scope);
  const tokenRef = useRef(token);
  const handledResponse = useRef<string | null>(null);
  useEffect(() => {
    currentScope.current = scope;
    tokenRef.current = token;
    handledResponse.current = null;
  }, [scope, token]);

  const refreshInbox = useCallback(async () => {
    if (!isApiConfigured || !token) return;
    const [rows, prefs] = await Promise.all([
      getCustomerNotifications(token),
      getNotificationPreferences(token),
    ]);
    if (currentScope.current !== scope) return;
    setPreferences(prefs);
    setNotifications((current) =>
      [...rows, ...current.filter((n) => n.id.startsWith('local-'))].slice(0, 150),
    );
  }, [token, scope]);

  useEffect(() => {
    let cancelled = false;
    tracking.current = null;
    (async () => {
      try {
        const [raw, enabled, storedTracking, savedInstallation] = await Promise.all([
          AsyncStorage.getItem(scope),
          AsyncStorage.getItem(scope + ':enabled'),
          AsyncStorage.getItem(scope + ':tracking'),
          AsyncStorage.getItem('scanmercado:push-installation:v1'),
        ]);
        if (cancelled) return;
        installation.current = savedInstallation ?? newKey().replace('cart-', 'device-');
        await AsyncStorage.setItem('scanmercado:push-installation:v1', installation.current);
        if (cancelled) return;
        setNotifications(raw ? JSON.parse(raw) : isApiConfigured ? [] : INITIAL_NOTIFICATIONS);
        setEnabled(enabled === 'true');
        setPreferences(NO_NOTIFICATION_PREFERENCES);
        setError(null);
        tracking.current = storedTracking
          ? JSON.parse(storedTracking)
          : { cartKey: newKey(), hadItems: false, fingerprint: '', revision: 0, pending: null };
        setReadyScope(scope);
        if (isApiConfigured && token) {
          const [prefs, inbox] = await Promise.all([
            getNotificationPreferences(token),
            getCustomerNotifications(token),
          ]);
          if (cancelled) return;
          setPreferences(prefs);
          setNotifications((current) => [
            ...inbox,
            ...current.filter((n) => n.id.startsWith('local-')),
          ]);
        }
      } catch (error) {
        if (!cancelled)
          setError(error instanceof Error ? error.message : 'Não foi possível carregar os avisos.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, token]);

  useEffect(() => {
    if (readyScope === scope)
      AsyncStorage.setItem(scope, JSON.stringify(notifications)).catch(() => {});
  }, [notifications, scope, readyScope]);

  const flushCart = useCallback(async () => {
    if (!isApiConfigured || !token || readyScope !== scope) return;
    const state = tracking.current;
    const snapshot = state?.pending;
    if (!state || !snapshot) return;
    const previous = chain.current;
    const task = previous
      .catch(() => {})
      .then(async () => {
        if (currentScope.current !== scope || tokenRef.current !== token) return;
        await syncCustomerCart(token, snapshot);
        if (currentScope.current !== scope) return;
        if (state.pending?.revision === snapshot.revision) state.pending = null;
        await AsyncStorage.setItem(scope + ':tracking', JSON.stringify(state));
      });
    chain.current = task;
    await task;
  }, [token, scope, readyScope]);

  const snapshotCart = useCallback(
    (heartbeat = false) => {
      if (!cartReady || readyScope !== scope || !token || !isApiConfigured || !tracking.current)
        return;
      const state = tracking.current;
      const normalized = engagementItems(items);
      const fingerprint = JSON.stringify({ storeId, items: normalized });
      if (state.fingerprint === fingerprint && !heartbeat) return;
      if (!state.hadItems && state.fingerprint !== fingerprint) state.cartKey = newKey();
      state.hadItems = items.length > 0;
      state.fingerprint = fingerprint;
      state.revision = Math.max(Date.now(), state.revision + 1);
      state.pending = {
        cartKey: state.cartKey,
        revision: state.revision,
        storeId,
        items: normalized,
      };
      AsyncStorage.setItem(scope + ':tracking', JSON.stringify(state)).catch(() => {});
    },
    [items, storeId, cartReady, readyScope, scope, token],
  );

  useEffect(() => {
    snapshotCart();
    const timer = setTimeout(() => void flushCart().catch(() => {}), 1500);
    return () => clearTimeout(timer);
  }, [snapshotCart, flushCart]);

  const checkDevice = useCallback(async () => {
    if (!pushEnabled || !token || !isApiConfigured || readyScope !== scope) return;
    try {
      const device = await getPushRegistration(false);
      if (currentScope.current !== scope || tokenRef.current !== token) return;
      await registerPushDevice(token, { ...device, installationId: installation.current });
      if (currentScope.current === scope) setError(null);
    } catch (error) {
      const module = await loadPushModule();
      const permission = await module?.getPermissionsAsync().catch(() => null);
      if (permission && !permission.granted) {
        await disablePushDevice(token, installation.current).catch(() => {});
        if (currentScope.current === scope) {
          setEnabled(false);
          await AsyncStorage.setItem(scope + ':enabled', 'false');
        }
      }
      if (currentScope.current === scope)
        setError(
          error instanceof Error ? error.message : 'Não foi possível conectar as notificações.',
        );
    }
  }, [pushEnabled, token, readyScope, scope]);

  useEffect(() => {
    const initial = setTimeout(() => void checkDevice(), 0);
    const heartbeat = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      snapshotCart(true);
      void flushCart().catch(() => {});
    }, 60000);
    const listener = AppState.addEventListener('change', (state) => {
      snapshotCart(true);
      void flushCart().catch(() => {});
      if (state === 'active') {
        void refreshInbox().catch(() => {});
        void checkDevice();
      }
    });
    return () => {
      clearTimeout(initial);
      clearInterval(heartbeat);
      listener.remove();
    };
  }, [checkDevice, snapshotCart, flushCart, refreshInbox]);

  const openNotification = useCallback(
    (item: NotificationItem) => {
      setNotifications((current) =>
        current.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
      if (token && isApiConfigured && !item.id.startsWith('local-'))
        void readCustomerNotification(token, item.id, true).catch(() => {});
      if (item.target === 'cart') router.push('/cart');
      if (item.target === 'promotions')
        router.push({ pathname: '/promotions', params: { offerId: item.offerId ?? '' } });
    },
    [token],
  );

  useEffect(() => {
    if (!token || readyScope !== scope) return;
    let disposed = false;
    let clean = () => {};
    (async () => {
      const module = await loadPushModule();
      if (!module || disposed) return;
      const handle = async (response: import('expo-notifications').NotificationResponse) => {
        const id = response.notification.request.content.data?.notificationId;
        if (typeof id !== 'string' || id === handledResponse.current) return;
        const inbox = await getCustomerNotifications(token);
        if (disposed) return;
        const item = inbox.find((n) => n.id === id);
        if (!item) return;
        handledResponse.current = id;
        openNotification(item);
      };
      const responses = module.addNotificationResponseReceivedListener(
        (response) => void handle(response).catch(() => {}),
      );
      const incoming = module.addNotificationReceivedListener(
        () => void refreshInbox().catch(() => {}),
      );
      const previous = module.getLastNotificationResponse();
      if (previous) void handle(previous).catch(() => {});
      clean = () => {
        responses.remove();
        incoming.remove();
      };
    })();
    return () => {
      disposed = true;
      clean();
    };
  }, [token, readyScope, scope, openNotification, refreshInbox]);

  const setPushEnabled = useCallback(
    async (value: boolean) => {
      setBusy(true);
      setError(null);
      try {
        if (!token || !isApiConfigured)
          throw new Error('Entre na sua conta para receber ofertas e lembretes neste celular.');
        if (!installation.current || readyScope !== scope)
          throw new Error('Aguarde o carregamento das preferências.');
        if (value) {
          const device = await getPushRegistration(true);
          await registerPushDevice(token, { ...device, installationId: installation.current });
          const next =
            preferences.cartReminders || preferences.personalizedOffers
              ? preferences
              : { cartReminders: true, personalizedOffers: false };
          const saved = await saveNotificationPreferences(token, next);
          if (currentScope.current !== scope) return false;
          setPreferences(saved);
        } else {
          await saveNotificationPreferences(token, NO_NOTIFICATION_PREFERENCES);
          await disablePushDevice(token, installation.current);
          setPreferences(NO_NOTIFICATION_PREFERENCES);
        }
        if (currentScope.current !== scope) return false;
        setEnabled(value);
        await AsyncStorage.setItem(scope + ':enabled', JSON.stringify(value));
        return true;
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Não foi possível salvar as preferências.',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [token, scope, readyScope, preferences],
  );

  const updatePreference = useCallback(
    async (kind: keyof NotificationPreferences, value: boolean) => {
      if (!token || !pushEnabled || busy) return;
      setBusy(true);
      setError(null);
      try {
        const saved = await saveNotificationPreferences(token, { ...preferences, [kind]: value });
        if (currentScope.current === scope) setPreferences(saved);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Não foi possível salvar sua preferência.',
        );
      } finally {
        setBusy(false);
      }
    },
    [token, pushEnabled, busy, preferences, scope],
  );

  const markAsRead = useCallback(
    (id: string) => {
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
      if (token && isApiConfigured && !id.startsWith('local-'))
        void readCustomerNotification(token, id).catch(() => {});
    },
    [token],
  );
  const markAllAsRead = useCallback(
    () => notifications.filter((n) => !n.read).forEach((n) => markAsRead(n.id)),
    [notifications, markAsRead],
  );
  const notify = useCallback(
    ({ title, body, kind }: { title: string; body: string; kind: NotificationKind }) => {
      setNotifications((current) =>
        [
          {
            id: `local-${Date.now()}-${Math.random()}`,
            title,
            body,
            kind,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...current,
        ].slice(0, 150),
      );
      if (pushEnabled)
        void loadPushModule()
          .then(async (module) => {
            if (module && (await module.getPermissionsAsync()).granted)
              await module.scheduleNotificationAsync({ content: { title, body }, trigger: null });
          })
          .catch(() => {});
    },
    [pushEnabled],
  );

  const confirmPurchase = useCallback(async () => {
    if (!token || !isApiConfigured)
      throw new Error('Entre na sua conta para confirmar uma compra.');
    snapshotCart();
    const state = tracking.current;
    if (!state || !items.length) throw new Error('O carrinho ainda está carregando.');
    await flushCart();
    await recordCustomerPurchase(token, {
      requestKey: `purchase-${state.cartKey}`,
      cartKey: state.cartKey,
      storeId,
      items: engagementItems(items),
    });
  }, [token, items, storeId, snapshotCart, flushCart]);

  const value = useMemo<Value>(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      pushEnabled,
      preferences,
      pushError,
      busy,
      markAsRead,
      markAllAsRead,
      openNotification,
      notify,
      setPushEnabled,
      updatePreference,
      confirmPurchase,
      refreshInbox,
    }),
    [
      notifications,
      pushEnabled,
      preferences,
      pushError,
      busy,
      markAsRead,
      markAllAsRead,
      openNotification,
      notify,
      setPushEnabled,
      updatePreference,
      confirmPurchase,
      refreshInbox,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error('useNotifications deve ser usado dentro de um NotificationsProvider');
  return value;
}
