import { demoStorageKey } from '../services/demo';
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

const STORAGE_KEY = demoStorageKey('scanmercado:favorites:v1');

type FavoritesContextValue = {
  favoriteBarcodes: string[];
  isFavorite: (barcode: string) => boolean;
  toggleFavorite: (barcode: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: PropsWithChildren) {
  const [favoriteBarcodes, setFavoriteBarcodes] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setFavoriteBarcodes(JSON.parse(raw));
      })
      .finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteBarcodes)).catch(() => {});
  }, [favoriteBarcodes, isLoaded]);

  const toggleFavorite = useCallback((barcode: string) => {
    setFavoriteBarcodes((current) =>
      current.includes(barcode)
        ? current.filter((item) => item !== barcode)
        : [...current, barcode],
    );
  }, []);

  const isFavorite = useCallback(
    (barcode: string) => favoriteBarcodes.includes(barcode),
    [favoriteBarcodes],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({ favoriteBarcodes, isFavorite, toggleFavorite }),
    [favoriteBarcodes, isFavorite, toggleFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites deve ser usado dentro de um FavoritesProvider');
  }
  return context;
}
