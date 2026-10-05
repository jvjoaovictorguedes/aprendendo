import { Product } from '../types';

// Catálogo de demonstração para o app piloto.
// Em produção isso viria de uma API do supermercado (preços e promoções ao vivo).
export const MOCK_PRODUCTS: Product[] = [
  {
    barcode: '7891000100103',
    name: 'Arroz Branco 5kg',
    price: 24.9,
    unit: 'un',
    category: 'Mercearia',
  },
  {
    barcode: '7891000100202',
    name: 'Feijão Carioca 1kg',
    price: 8.49,
    unit: 'un',
    category: 'Mercearia',
    promotion: { kind: 'percentOff', percent: 15, label: '15% OFF' },
  },
  {
    barcode: '7891000100301',
    name: 'Óleo de Soja 900ml',
    price: 7.99,
    unit: 'un',
    category: 'Mercearia',
  },
  {
    barcode: '7891000200104',
    name: 'Leite Integral 1L',
    price: 5.49,
    unit: 'un',
    category: 'Laticínios',
    promotion: { kind: 'buyXPayY', buy: 3, pay: 2, label: 'Leve 3 Pague 2' },
  },
  {
    barcode: '7891000200203',
    name: 'Queijo Mussarela 500g',
    price: 22.9,
    unit: 'un',
    category: 'Laticínios',
  },
  {
    barcode: '7891000300105',
    name: 'Refrigerante Cola 2L',
    price: 9.99,
    unit: 'un',
    category: 'Bebidas',
    promotion: { kind: 'fixedPrice', price: 6.99, label: 'Preço especial' },
  },
  {
    barcode: '7891000300204',
    name: 'Água Mineral 1,5L',
    price: 3.5,
    unit: 'un',
    category: 'Bebidas',
  },
  {
    barcode: '7891000400106',
    name: 'Café Torrado 500g',
    price: 14.5,
    unit: 'un',
    category: 'Mercearia',
  },
  {
    barcode: '7891000400205',
    name: 'Pão de Forma Integral',
    price: 8.9,
    unit: 'un',
    category: 'Padaria',
  },
  {
    barcode: '7891000500107',
    name: 'Sabão em Pó 1,6kg',
    price: 19.9,
    unit: 'un',
    category: 'Limpeza',
    promotion: { kind: 'percentOff', percent: 20, label: '20% OFF' },
  },
  {
    barcode: '7891000500206',
    name: 'Detergente 500ml',
    price: 2.79,
    unit: 'un',
    category: 'Limpeza',
  },
  {
    barcode: '7891000600108',
    name: 'Papel Higiênico 12 rolos',
    price: 23.9,
    unit: 'un',
    category: 'Higiene',
  },
  {
    barcode: '7891000600207',
    name: 'Shampoo 350ml',
    price: 16.9,
    unit: 'un',
    category: 'Higiene',
  },
  {
    barcode: '7891000700109',
    name: 'Maçã Gala (kg)',
    price: 7.99,
    unit: 'kg',
    category: 'Hortifruti',
  },
  {
    barcode: '7891000700208',
    name: 'Banana Prata (kg)',
    price: 5.49,
    unit: 'kg',
    category: 'Hortifruti',
    promotion: { kind: 'percentOff', percent: 10, label: '10% OFF' },
  },
];

export function findProductByName(name: string): Product | undefined {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;
  return MOCK_PRODUCTS.find((product) => product.name.toLowerCase().includes(normalized));
}

export function findProductByBarcode(barcode: string): Product | undefined {
  return MOCK_PRODUCTS.find((product) => product.barcode === barcode);
}
