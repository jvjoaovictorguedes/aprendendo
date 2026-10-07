import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { MEMBER_PROMOTIONS } from '../data/memberPromotions';
import { MOCK_PRODUCTS } from '../data/products';
import { apiRequest, appTenantId, isApiConfigured } from '../services/api';
import { listOffers, Offer } from '../services/offers';
import { useAuth } from './AuthContext';
import { useStore } from './StoreContext';
import { useCart } from './CartContext';

type Value = {
  offers: Offer[];
  activatedIds: string[];
  loading: boolean;
  error: string | null;
  pendingId: string | null;
  isActivated: (id: string) => boolean;
  toggleActivation: (id: string) => Promise<void>;
  extraPercentOffFor: (barcode: string) => number;
  offersFor: (barcode: string) => Offer[];
  refresh: () => Promise<void>;
};
const Context = createContext<Value | null>(null);
const demoOffers: Offer[] = [
  ...MOCK_PRODUCTS.filter((p) => p.promotion).map((product, index) => {
    const p = product.promotion!;
    return {
      id: `demo-${index}`,
      productId: product.barcode,
      product: { ...product, promotion: undefined },
      label: p.label,
      audience: 'all' as const,
      kind:
        p.kind === 'percentOff'
          ? ('percent_off' as const)
          : p.kind === 'fixedPrice'
            ? ('fixed_price' as const)
            : ('buy_x_pay_y' as const),
      percent: p.kind === 'percentOff' ? p.percent : null,
      price: p.kind === 'fixedPrice' ? p.price : null,
      buy: p.kind === 'buyXPayY' ? p.buy : null,
      pay: p.kind === 'buyXPayY' ? p.pay : null,
      storeId: null,
      storeName: null,
      startsAt: '2020-01-01T00:00:00Z',
      endsAt: null,
      maxQuantity: null,
      conditions: 'Oferta de demonstração.',
      active: true,
    };
  }),
  ...MEMBER_PROMOTIONS.flatMap((p) => {
    const product = MOCK_PRODUCTS.find((product) => product.barcode === p.barcode);
    return product
      ? [
          {
            id: p.id,
            productId: product.barcode,
            product: { ...product, promotion: undefined },
            label: p.label,
            audience: 'club' as const,
            kind: 'percent_off' as const,
            percent: p.extraPercentOff,
            price: null,
            buy: null,
            pay: null,
            storeId: null,
            storeName: null,
            startsAt: '2020-01-01T00:00:00Z',
            endsAt: null,
            maxQuantity: null,
            conditions: 'Cupom de demonstração; desconto extra sobre a oferta geral.',
            active: true,
          },
        ]
      : [];
  }),
];
export function PromotionsProvider({ children }: PropsWithChildren) {
  const { user, token, isReady } = useAuth();
  const { storeId } = useStore();
  const { items, refreshPrices } = useCart();
  const [rawOffers, setOffers] = useState<Offer[]>([]);
  const [activatedIds, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const version = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  const key = `scanmercado:activated-promos:${appTenantId ?? 'demo'}:${user?.id ?? 'guest'}`;
  const refresh = useCallback(async () => {
    if (!isReady) return;
    const v = ++version.current;
    setLoading(true);
    setError(null);
    try {
      const [offers, ids] = await Promise.all([
        isApiConfigured ? listOffers(storeId) : Promise.resolve(demoOffers),
        isApiConfigured
          ? token
            ? apiRequest<string[]>('/customer/activations', { auth: token })
            : Promise.resolve([])
          : user
            ? AsyncStorage.getItem(key).then((raw) => (raw ? (JSON.parse(raw) as string[]) : []))
            : Promise.resolve([]),
      ]);
      if (v !== version.current) return;
      setOffers(offers);
      setIds(ids);
      setNow(Date.now());
    } catch (e) {
      if (v === version.current) {
        setOffers([]);
        setIds([]);
        setError(e instanceof Error ? e.message : 'Ofertas indisponíveis.');
      }
    } finally {
      if (v === version.current) setLoading(false);
    }
  }, [storeId, token, key, user, isReady]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffers([]);
      setIds([]);
      void refresh();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      void refresh();
      void refreshPrices();
    }, 60000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
        void refreshPrices();
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh, refreshPrices]);
  const offers = rawOffers.filter(
    (o) =>
      o.active &&
      Date.parse(o.startsAt) <= now &&
      (!o.endsAt || Date.parse(o.endsAt) > now) &&
      (!o.storeId || o.storeId === storeId),
  );
  const toggleActivation = useCallback(
    async (id: string) => {
      if (!user || busy.current) return;
      const offer = offers.find((o) => o.id === id && o.audience === 'club');
      if (!offer) return;
      busy.current = true;
      setPending(id);
      setError(null);
      const active = activatedIds.includes(id),
        v = version.current;
      try {
        const next = active ? activatedIds.filter((x) => x !== id) : [...activatedIds, id];
        if (isApiConfigured) {
          if (!token) throw new Error('Entre novamente para ativar ofertas.');
          await apiRequest(`/customer/activations/${id}`, {
            auth: token,
            method: active ? 'DELETE' : 'PUT',
          });
        } else await AsyncStorage.setItem(key, JSON.stringify(next));
        if (v === version.current) setIds(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível ativar a oferta.');
      } finally {
        busy.current = false;
        setPending(null);
      }
    },
    [user, token, offers, activatedIds, key],
  );
  const offersFor = (barcode: string) => offers.filter((o) => o.product.barcode === barcode);
  const extraPercentOffFor = (barcode: string) => {
    if (!user || error) return 0;
    const quantity = items
      .filter((i) => i.product.barcode === barcode)
      .reduce((sum, i) => sum + (i.weighed ? i.weighed.weightKg : 1) * i.quantity, 0);
    return offersFor(barcode)
      .filter(
        (o) =>
          o.audience === 'club' &&
          activatedIds.includes(o.id) &&
          (!o.endsAt || Date.parse(o.endsAt) > Date.now()),
      )
      .reduce(
        (max, o) =>
          Math.max(
            max,
            (o.percent ?? 0) *
              (o.maxQuantity && quantity ? Math.min(1, o.maxQuantity / quantity) : 1),
          ),
        0,
      );
  };
  return (
    <Context.Provider
      value={{
        offers,
        activatedIds,
        loading,
        error,
        pendingId,
        isActivated: (id) => !!user && activatedIds.includes(id),
        toggleActivation,
        extraPercentOffFor,
        offersFor,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePromotions() {
  const c = useContext(Context);
  if (!c) throw new Error('PromotionsProvider necessário');
  return c;
}
