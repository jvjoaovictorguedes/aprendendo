export type Promotion =
  | { kind: 'percentOff'; percent: number; label: string }
  | { kind: 'buyXPayY'; buy: number; pay: number; label: string }
  | { kind: 'fixedPrice'; price: number; label: string };

export type Product = {
  /** Produtos vendidos só por peso (sem EAN próprio) usam "plu:<PLU>". */
  barcode: string;
  /** Código do produto na balança, sem zeros à esquerda. */
  plu?: string;
  name: string;
  /** Para unit = 'kg', é o preço do kg. */
  price: number;
  unit: 'un' | 'kg';
  category: string;
  promotion?: Promotion;
};

/** Linha que veio de uma etiqueta de balança. */
export type WeighedInfo = {
  labelCode: string;
  weightKg: number;
  /** Etiqueta de preço só traz o total — o peso é calculado (total ÷ preço/kg). */
  weightIsEstimated: boolean;
  labelTotal: number;
};

export type CartItem = {
  product: Product;
  quantity: number;
  weighed?: WeighedInfo;
};

/** Cada etiqueta de balança é uma linha própria; produto comum agrupa pelo EAN. */
export function cartItemKey(item: CartItem): string {
  return item.weighed?.labelCode ?? item.product.barcode;
}

export type Purchase = {
  id: string;
  date: string; // ISO
  items: CartItem[];
  originalTotal: number;
  finalTotal: number;
  savings: number;
};

export type ShoppingListItem = {
  id: string;
  name: string;
  barcode?: string; // quando o item corresponde a um produto do catálogo
  bought: boolean;
};

export type ShoppingList = {
  id: string;
  name: string;
  createdAt: string; // ISO
  items: ShoppingListItem[];
};
