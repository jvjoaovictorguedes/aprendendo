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
