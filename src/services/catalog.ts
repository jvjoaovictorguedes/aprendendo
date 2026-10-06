import {
  findProductByBarcode as findMockProductByBarcode,
  findProductByPlu as findMockProductByPlu,
} from '../data/products';
import { Product, Promotion } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

type PromotionRow = {
  kind: 'percent_off' | 'buy_x_pay_y' | 'fixed_price';
  label: string;
  percent: number | null;
  buy_qty: number | null;
  pay_qty: number | null;
  fixed_price: number | null;
  active: boolean;
};

type ProductRow = {
  barcode: string | null;
  plu: string | null;
  name: string;
  price: number;
  unit: 'un' | 'kg';
  category: string;
  promotions: PromotionRow[] | null;
};

const PRODUCT_COLUMNS =
  'barcode, plu, name, price, unit, category, promotions(kind, label, percent, buy_qty, pay_qty, fixed_price, active)';

function mapPromotionRow(row: PromotionRow | undefined): Promotion | undefined {
  if (!row) return undefined;
  switch (row.kind) {
    case 'percent_off':
      return { kind: 'percentOff', percent: Number(row.percent ?? 0), label: row.label };
    case 'buy_x_pay_y':
      return { kind: 'buyXPayY', buy: row.buy_qty ?? 1, pay: row.pay_qty ?? 1, label: row.label };
    case 'fixed_price':
      return { kind: 'fixedPrice', price: Number(row.fixed_price ?? 0), label: row.label };
    default:
      return undefined;
  }
}

function mapProductRow(row: ProductRow): Product {
  const activePromotion = (row.promotions ?? []).find((promo) => promo.active !== false);
  return {
    barcode: row.barcode ?? `plu:${row.plu}`,
    plu: row.plu ?? undefined,
    name: row.name,
    price: Number(row.price),
    unit: row.unit,
    category: row.category,
    promotion: mapPromotionRow(activePromotion),
  };
}

export type CatalogSource = 'supabase' | 'mock';

export type CatalogLookupResult = {
  product: Product | null;
  source: CatalogSource;
};

/**
 * Busca um produto numa coluna do catálogo (barcode ou plu).
 * Usa o Supabase quando configurado (EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY);
 * cai para o catálogo mock local se o Supabase não estiver configurado, ou se a
 * chamada falhar (sem internet, erro de rede) — o scanner nunca trava sem resposta.
 */
async function lookupProduct(
  column: 'barcode' | 'plu',
  code: string,
  findMock: (code: string) => Product | undefined,
): Promise<CatalogLookupResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { product: findMock(code) ?? null, source: 'mock' };
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq(column, code)
      .eq('active', true)
      .maybeSingle<ProductRow>();

    if (error) throw error;
    if (!data) return { product: null, source: 'supabase' };

    return { product: mapProductRow(data), source: 'supabase' };
  } catch (err) {
    console.warn('Falha ao consultar o Supabase, usando catálogo local como alternativa:', err);
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
