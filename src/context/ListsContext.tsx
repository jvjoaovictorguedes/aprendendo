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

import { ShoppingList } from '../types';

const STORAGE_KEY = demoStorageKey('scanmercado:lists:v1');
const ACTIVE_KEY = demoStorageKey('scanmercado:active-list:v1');

type ListsContextValue = {
  lists: ShoppingList[];
  activeListId: string | null;
  createList: (name: string) => ShoppingList;
  removeList: (listId: string) => void;
  addItem: (listId: string, name: string, barcode?: string) => void;
  removeItem: (listId: string, itemId: string) => void;
  toggleBought: (listId: string, itemId: string) => void;
  setActiveListId: (listId: string | null) => void;
  /** Chamado pelo scanner: se o código bipado estiver na lista ativa, marca como comprado. */
  markBoughtByBarcode: (barcode: string) => { listName: string; itemName: string } | null;
};

const ListsContext = createContext<ListsContextValue | undefined>(undefined);

export function ListsProvider({ children }: PropsWithChildren) {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeListId, setActiveListIdState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(ACTIVE_KEY)]).then(
      ([rawLists, rawActive]) => {
        if (rawLists) setLists(JSON.parse(rawLists));
        if (rawActive) setActiveListIdState(JSON.parse(rawActive));
        setIsLoaded(true);
      },
    );
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lists)).catch(() => {});
  }, [lists, isLoaded]);

  const setActiveListId = useCallback((listId: string | null) => {
    setActiveListIdState(listId);
    AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(listId)).catch(() => {});
  }, []);

  const createList = useCallback((name: string) => {
    const list: ShoppingList = {
      id: `l_${Date.now()}`,
      name: name.trim() || 'Lista sem nome',
      createdAt: new Date().toISOString(),
      items: [],
    };
    setLists((current) => [list, ...current]);
    return list;
  }, []);

  const removeList = useCallback(
    (listId: string) => {
      setLists((current) => current.filter((list) => list.id !== listId));
      if (activeListId === listId) setActiveListId(null);
    },
    [activeListId, setActiveListId],
  );

  const addItem = useCallback((listId: string, name: string, barcode?: string) => {
    if (!name.trim()) return;
    setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: [
                ...list.items,
                {
                  id: `i_${Date.now()}`,
                  name: name.trim(),
                  barcode,
                  bought: false,
                },
              ],
            }
          : list,
      ),
    );
  }, []);

  const removeItem = useCallback((listId: string, itemId: string) => {
    setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? { ...list, items: list.items.filter((item) => item.id !== itemId) }
          : list,
      ),
    );
  }, []);

  const toggleBought = useCallback((listId: string, itemId: string) => {
    setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId ? { ...item, bought: !item.bought } : item,
              ),
            }
          : list,
      ),
    );
  }, []);

  const markBoughtByBarcode = useCallback(
    (barcode: string) => {
      const activeList = lists.find((list) => list.id === activeListId);
      if (!activeList) return null;

      const match = activeList.items.find((item) => item.barcode === barcode && !item.bought);
      if (!match) return null;

      setLists((current) =>
        current.map((list) =>
          list.id === activeList.id
            ? {
                ...list,
                items: list.items.map((item) =>
                  item.id === match.id ? { ...item, bought: true } : item,
                ),
              }
            : list,
        ),
      );

      return { listName: activeList.name, itemName: match.name };
    },
    [lists, activeListId],
  );

  const value = useMemo<ListsContextValue>(
    () => ({
      lists,
      activeListId,
      createList,
      removeList,
      addItem,
      removeItem,
      toggleBought,
      setActiveListId,
      markBoughtByBarcode,
    }),
    [
      lists,
      activeListId,
      createList,
      removeList,
      addItem,
      removeItem,
      toggleBought,
      setActiveListId,
      markBoughtByBarcode,
    ],
  );

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}

export function useLists(): ListsContextValue {
  const context = useContext(ListsContext);
  if (!context) {
    throw new Error('useLists deve ser usado dentro de um ListsProvider');
  }
  return context;
}
