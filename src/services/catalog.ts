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
 * O catálogo de demonstração só é usado sem API configurada. Uma falha de
 * conexão nunca substitui preços reais por valores fictícios.
 */
async function lookupProduct(
  kind: 'barcode' | 'plu',
  code: string,
  findMock: (code: string) => Product | undefined,
  storeId?: string | null,
): Promise<CatalogLookupResult> {
  if (!isApiConfigured) {
    return { product: findMock(code) ?? null, source: 'mock' };
  }

  try {
    const product = await apiRequest<Product>(
      `/public/products/${kind}/${encodeURIComponent(code)}`,
      {
        tenant: true,
        query: { storeId },
      },
    );
    return { product, source: 'api' };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return { product: null, source: 'api' };
    }
    throw err;
  }
}

export function fetchProductByBarcode(
  barcode: string,
  storeId?: string | null,
): Promise<CatalogLookupResult> {
  return lookupProduct('barcode', barcode, findMockProductByBarcode, storeId);
}

/** Produto pesado, pelo PLU lido da etiqueta da balança. */
export function fetchProductByPlu(
  plu: string,
  storeId?: string | null,
): Promise<CatalogLookupResult> {
  return lookupProduct('plu', plu, findMockProductByPlu, storeId);
}
