import {
  findProductByBarcode as findMockProductByBarcode,
  findProductByPlu as findMockProductByPlu,
} from '../data/products';
import { Product } from '../types';
import { ApiError, apiRequest, isApiConfigured } from './api';

export type CatalogSource = 'api' | 'mock';

export type CatalogLookupResult = {
  product: Product | null;
  source: CatalogSource;
};

/**
 * Busca um produto no catálogo da franquia (por código de barras ou PLU).
 * Usa a API quando configurada (EXPO_PUBLIC_API_URL + EXPO_PUBLIC_TENANT_ID);
 * cai para o catálogo mock local se a API não estiver configurada, ou se a
 * chamada falhar (sem internet) — o scanner nunca trava sem resposta.
 */
async function lookupProduct(
  kind: 'barcode' | 'plu',
  code: string,
  findMock: (code: string) => Product | undefined,
): Promise<CatalogLookupResult> {
  if (!isApiConfigured) {
    return { product: findMock(code) ?? null, source: 'mock' };
  }

  try {
    const product = await apiRequest<Product>(`/public/products/${kind}/${encodeURIComponent(code)}`, {
      tenant: true,
    });
    return { product, source: 'api' };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return { product: null, source: 'api' };
    }
    console.warn('Falha ao consultar a API, usando catálogo local como alternativa:', err);
    return { product: findMock(code) ?? null, source: 'mock' };
  }
}

export function fetchProductByBarcode(barcode: string): Promise<CatalogLookupResult> {
  return lookupProduct('barcode', barcode, findMockProductByBarcode);
}

/** Produto pesado, pelo PLU lido da etiqueta da balança. */
export function fetchProductByPlu(plu: string): Promise<CatalogLookupResult> {
  return lookupProduct('plu', plu, findMockProductByPlu);
}
