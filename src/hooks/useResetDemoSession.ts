import { useAuth } from '../context/AuthContext';
import { useBudget } from '../context/BudgetContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { useHistory } from '../context/HistoryContext';
import { useStore } from '../context/StoreContext';
import { useRefreshTenantSettings } from '../context/TenantSettingsContext';
import { usePromotions } from '../context/PromotionsContext';
import { useLists } from '../context/ListsContext';
import { clearDemoDevice, DEMO_TENANT } from '../services/demo';
import { appTenantId } from '../services/api';

/** Apaga somente a sessão fictícia; preserva a sessão administrativa. */
export function useResetDemoSession() {
  const { selectStore, reload: reloadStores } = useStore();
  const refreshSettings = useRefreshTenantSettings();
  const { refresh: refreshOffers } = usePromotions();
  const { logout } = useAuth();
  const { clearCart } = useCart();
  const { clearHistory } = useHistory();
  const { lists, removeList, setActiveListId } = useLists();
  const { favoriteBarcodes, toggleFavorite } = useFavorites();
  const { setLimit } = useBudget();
  return async () => {
    if (appTenantId !== DEMO_TENANT) return;
    await clearDemoDevice();
    clearCart();
    clearHistory();
    lists.forEach((list) => removeList(list.id));
    setActiveListId(null);
    favoriteBarcodes.forEach(toggleFavorite);
    setLimit(null);
    logout();
    selectStore(null);
    await Promise.all([refreshSettings(), reloadStores(), refreshOffers()]);
  };
}
