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

import { fetchProductByBarcode, fetchProductByPlu, CatalogSource } from '../services/catalog';
import { CartItem, cartItemKey, Product, WeighedInfo } from '../types';
import { parseScaleLabel, resolveScaleLabel } from '../utils/scaleLabel';

import { useTenantSettings } from './TenantSettingsContext';

const STORAGE_KEY = 'scanmercado:cart:v1';

type AddResult =
  | { status: 'added'; key: string; product: Product; source: CatalogSource; weighed?: WeighedInfo }
  | { status: 'not_found'; barcode: string; source: CatalogSource };

type CartContextValue = {
  items: CartItem[];
  addByBarcode: (code: string) => Promise<AddResult>;
  /** As três recebem cartItemKey(item). */
  incrementItem: (key: string) => void;
  decrementItem: (key: string) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: PropsWithChildren) {
  const { scale } = useTenantSettings();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setItems(JSON.parse(raw));
      })
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
          cartItemKey(item) === key ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, line];
    });
  }, []);

  const addByBarcode = useCallback(
    async (code: string): Promise<AddResult> => {
      // Etiqueta de balança: o PLU identifica o produto e o valor vem no código.
      // Se o PLU não existir no catálogo, segue como código de barras comum.
      const label = parseScaleLabel(code, scale);
      if (label) {
        const { product, source } = await fetchProductByPlu(label.plu);
        if (product) {
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
      }

      const { product, source } = await fetchProductByBarcode(code);
      if (!product) {
        return { status: 'not_found', barcode: code, source };
      }

      addLine(product.barcode, { product, quantity: 1 });
      return { status: 'added', key: product.barcode, product, source };
    },
    [scale, addLine],
  );

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
    () => ({ items, addByBarcode, incrementItem, decrementItem, removeItem, clearCart }),
    [items, addByBarcode, incrementItem, decrementItem, removeItem, clearCart],
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
