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
        if (raw) setItems(JSON.parse(raw));
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

  const requests = useRef(0);
  const itemCodes = items.map((i) => `${i.product.barcode}:${i.product.plu ?? ''}`).join('|');
  const refreshPrices = useCallback(async () => {
    if (!isApiConfigured || !itemCodes) {
      setPriceError(null);
      setRefreshing(false);
      return;
    }
    const request = ++requests.current;
    setRefreshing(true);
    try {
      const prices = await Promise.all(
        itemCodes.split('|').map(async (code) => {
          const [barcode, ...rest] = code.split(':');
          const plu = rest[0];
          const result =
            barcode === 'plu'
              ? await fetchProductByPlu(plu, storeId)
              : await fetchProductByBarcode(barcode, storeId);
          if (!result.product)
            throw new Error('Um produto do carrinho ficou indisponível. Confira com a loja.');
          return result.product;
        }),
      );
      if (request !== requests.current) return;
      setItems((current) =>
        current.map((item) => ({
          ...item,
          product: prices.find((p) => p.barcode === item.product.barcode) ?? item.product,
        })),
      );
      setPriceError(null);
    } catch (e) {
      if (request === requests.current)
        setPriceError(e instanceof Error ? e.message : 'Não foi possível atualizar os preços.');
    } finally {
      if (request === requests.current) setRefreshing(false);
    }
  }, [storeId, itemCodes]);
  useEffect(() => {
    const guard = requests;
    guard.current++;
    const timer = setTimeout(() => void refreshPrices(), 0);
    return () => {
      clearTimeout(timer);
      guard.current++;
    };
  }, [refreshPrices]);

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
