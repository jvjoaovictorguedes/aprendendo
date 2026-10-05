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

import { fetchProductByBarcode, CatalogSource } from '../services/catalog';
import { CartItem, Product } from '../types';

const STORAGE_KEY = 'scanmercado:cart:v1';

type AddResult =
  | { status: 'added'; product: Product; source: CatalogSource }
  | { status: 'not_found'; barcode: string };

type CartContextValue = {
  items: CartItem[];
  addByBarcode: (barcode: string) => Promise<AddResult>;
  incrementItem: (barcode: string) => void;
  decrementItem: (barcode: string) => void;
  removeItem: (barcode: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: PropsWithChildren) {
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

  const addByBarcode = useCallback(async (barcode: string): Promise<AddResult> => {
    const { product, source } = await fetchProductByBarcode(barcode);
    if (!product) {
      return { status: 'not_found', barcode };
    }

    setItems((current) => {
      const existing = current.find((item) => item.product.barcode === barcode);
      if (existing) {
        return current.map((item) =>
          item.product.barcode === barcode ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { product, quantity: 1 }];
    });

    return { status: 'added', product, source };
  }, []);

  const incrementItem = useCallback((barcode: string) => {
    setItems((current) =>
      current.map((item) =>
        item.product.barcode === barcode ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  }, []);

  const decrementItem = useCallback((barcode: string) => {
    setItems((current) =>
      current
        .map((item) =>
          item.product.barcode === barcode ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((barcode: string) => {
    setItems((current) => current.filter((item) => item.product.barcode !== barcode));
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
