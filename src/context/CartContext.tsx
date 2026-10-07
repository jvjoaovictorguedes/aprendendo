import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';

import { fetchProductByBarcode, fetchProductByPlu, CatalogSource } from '../services/catalog';
import { CartItem, cartItemKey, Product, WeighedInfo } from '../types';
import { roundCents } from '../utils/pricing';
import { readScannerLabel, resolveScaleLabel } from '../utils/scaleLabel';

import { useStore } from './StoreContext';
import { appTenantId, isApiConfigured } from '../services/api';
import { useTenantSettings } from './TenantSettingsContext';

const STORAGE_KEY = `scanmercado:cart:${appTenantId ?? 'demo'}:v2`;

type AddResult =
  | {
      status: 'added';
      key: string;
      product: Product;
      source: CatalogSource;
      weighed?: WeighedInfo;
    }
  | { status: 'error'; message: string }
  | { status: 'not_found'; barcode: string; source: CatalogSource };

type CartContextValue = {
  isReady: boolean;
  items: CartItem[];
  addByBarcode: (code: string) => Promise<AddResult>;
  /** As três recebem cartItemKey(item). */
  incrementItem: (key: string) => void;
  decrementItem: (key: string) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  refreshPrices: () => Promise<void>;
  priceError: string | null;
  refreshing: boolean;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: PropsWithChildren) {
  const { storeId } = useStore();
  const [priceError, setPriceError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { scale } = useTenantSettings();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const saved = raw ? JSON.parse(raw) : null;
        if (Array.isArray(saved)) setItems(saved);
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, isLoaded]);

  const addLine = useCallback((key: string, line: CartItem) => {
    setItems((current) => {
      if (current.some((item) => cartItemKey(item) === key)) {
        return current.map((item) =>
          cartItemKey(item) === key
            ? { ...item, product: line.product, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...current, line];
    });
  }, []);

  const addByBarcode = useCallback(
    async (code: string): Promise<AddResult> => {
      try {
        // Etiqueta de balança: o PLU identifica o produto e o valor vem no código.
        const label = readScannerLabel(code, scale);
        if (label) {
          const { product, source } = await fetchProductByPlu(label.plu, storeId);
          if (!product) {
            throw new Error(
              `Produto de balança com PLU ${label.plu} não cadastrado. Peça ao mercado para cadastrar o PLU da etiqueta.`,
            );
          }
          if (product.unit !== 'kg' || product.price <= 0) {
            throw new Error(
              `O produto com PLU ${label.plu} precisa estar cadastrado em kg, com preço por quilo válido.`,
            );
          }
          const resolved = resolveScaleLabel(label, product);
          const weighed: WeighedInfo = {
            labelCode: code,
            weightKg: resolved.weightKg,
            weightIsEstimated: resolved.weightIsEstimated,
            labelTotal: resolved.total,
          };
          // Duas etiquetas idênticas = mesmo peso e preço, então somam quantidade.
          addLine(code, { product, quantity: 1, weighed });
          return { status: 'added', key: code, product, source, weighed };
        }

        const { product, source } = await fetchProductByBarcode(code, storeId);
        if (!product) {
          return { status: 'not_found', barcode: code, source };
        }

        addLine(product.barcode, { product, quantity: 1 });
        return { status: 'added', key: product.barcode, product, source };
      } catch (e) {
        return {
          status: 'error',
          message:
            e instanceof Error ? e.message : 'Não foi possível consultar o preço. Tente novamente.',
        };
      }
    },
    [scale, storeId, addLine],
  );

  // Lê os itens por ref: atualizar preços não deve disparar a cada bipagem,
  // só ao abrir o app, trocar de loja, voltar para a tela ou no intervalo.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const requests = useRef(0);
  const refreshPrices = useCallback(async () => {
    const codes = Array.from(
      new Set(itemsRef.current.map((i) => `${i.product.barcode}\n${i.product.plu ?? ''}`)),
    );
    if (!isApiConfigured || codes.length === 0) {
      setPriceError(null);
      setRefreshing(false);
      return;
    }
    const request = ++requests.current;
    setRefreshing(true);
    try {
      const prices = await Promise.all(
        codes.map(async (code) => {
          const [barcode, plu] = code.split('\n');
          const result =
            barcode.startsWith('plu:') && plu
              ? await fetchProductByPlu(plu, storeId)
              : await fetchProductByBarcode(barcode, storeId);
          if (!result.product)
            throw new Error('Um produto do carrinho ficou indisponível. Confira com a loja.');
          return result.product;
        }),
      );
      if (request !== requests.current) return;
      setItems((current) =>
        current.map((item) => {
          const product = prices.find((p) => p.barcode === item.product.barcode);
          if (!product) return item;
          // Etiqueta com peso: o total depende do preço do kg, então acompanha o preço novo.
          // Etiqueta com preço: o total impresso vale; só o peso estimado é recalculado.
          const weighed =
            item.weighed && product.price > 0
              ? item.weighed.weightIsEstimated
                ? { ...item.weighed, weightKg: item.weighed.labelTotal / product.price }
                : {
                    ...item.weighed,
                    labelTotal: roundCents(item.weighed.weightKg * product.price),
                  }
              : item.weighed;
          return { ...item, product, weighed };
        }),
      );
      setPriceError(null);
    } catch (e) {
      if (request === requests.current)
        setPriceError(e instanceof Error ? e.message : 'Não foi possível atualizar os preços.');
    } finally {
      if (request === requests.current) setRefreshing(false);
    }
  }, [storeId]);
  useEffect(() => {
    if (!isLoaded) return;
    const guard = requests;
    const timer = setTimeout(() => void refreshPrices(), 0);
    return () => {
      clearTimeout(timer);
      guard.current++;
    };
  }, [refreshPrices, isLoaded]);

  const incrementItem = useCallback((key: string) => {
    setItems((current) =>
      current.map((item) =>
        cartItemKey(item) === key ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  }, []);

  const decrementItem = useCallback((key: string) => {
    setItems((current) =>
      current
        .map((item) =>
          cartItemKey(item) === key ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((current) => current.filter((item) => cartItemKey(item) !== key));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      isReady: isLoaded,
      items,
      addByBarcode,
      incrementItem,
      decrementItem,
      removeItem,
      clearCart,
      refreshPrices,
      priceError,
      refreshing,
    }),
    [
      isLoaded,
      items,
      addByBarcode,
      incrementItem,
      decrementItem,
      removeItem,
      clearCart,
      refreshPrices,
      priceError,
      refreshing,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart deve ser usado dentro de um CartProvider');
  }
  return context;
}
