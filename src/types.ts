export type Promotion =
  | { kind: 'percentOff'; percent: number; label: string }
  | { kind: 'buyXPayY'; buy: number; pay: number; label: string }
  | { kind: 'fixedPrice'; price: number; label: string };

export type Product = {
  barcode: string;
  name: string;
  price: number;
  unit: 'un' | 'kg';
  category: string;
  promotion?: Promotion;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

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
