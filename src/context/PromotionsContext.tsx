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

import { findMemberPromotionsByBarcode } from '../data/memberPromotions';

import { useAuth } from './AuthContext';

const STORAGE_KEY_PREFIX = 'scanmercado:activated-promos:';

type PromotionsContextValue = {
  activatedIds: string[];
  isActivated: (id: string) => boolean;
  toggleActivation: (id: string) => void;
  extraPercentOffFor: (barcode: string) => number;
};

const PromotionsContext = createContext<PromotionsContextValue | undefined>(undefined);

export function PromotionsProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [activatedIds, setActivatedIds] = useState<string[]>([]);

  const storageKey = user ? `${STORAGE_KEY_PREFIX}${user.id}` : null;

  useEffect(() => {
    Promise.resolve(storageKey ? AsyncStorage.getItem(storageKey) : null).then((raw) => {
      setActivatedIds(raw ? JSON.parse(raw) : []);
    });
  }, [storageKey]);

  const toggleActivation = useCallback(
    (id: string) => {
      if (!storageKey) return;
      setActivatedIds((current) => {
        const next = current.includes(id)
          ? current.filter((activeId) => activeId !== id)
          : [...current, id];
        AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [storageKey],
  );

  const isActivated = useCallback((id: string) => activatedIds.includes(id), [activatedIds]);

  const extraPercentOffFor = useCallback(
    (barcode: string) => {
      return findMemberPromotionsByBarcode(barcode)
        .filter((promo) => activatedIds.includes(promo.id))
        .reduce((max, promo) => Math.max(max, promo.extraPercentOff), 0);
    },
    [activatedIds],
  );

  const value = useMemo<PromotionsContextValue>(
    () => ({ activatedIds, isActivated, toggleActivation, extraPercentOffFor }),
    [activatedIds, isActivated, toggleActivation, extraPercentOffFor],
  );

  return <PromotionsContext.Provider value={value}>{children}</PromotionsContext.Provider>;
}

export function usePromotions(): PromotionsContextValue {
  const context = useContext(PromotionsContext);
  if (!context) {
    throw new Error('usePromotions deve ser usado dentro de um PromotionsProvider');
  }
  return context;
}
