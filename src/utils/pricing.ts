import { CartItem } from '../types';

export type LineTotal = {
  originalTotal: number;
  finalTotal: number;
  savings: number;
};

export function computeLineTotal(item: CartItem): LineTotal {
  const { product, quantity } = item;
  const originalTotal = product.price * quantity;
  const promotion = product.promotion;

  if (!promotion) {
    return { originalTotal, finalTotal: originalTotal, savings: 0 };
  }

  let finalTotal = originalTotal;

  switch (promotion.kind) {
    case 'percentOff':
      finalTotal = originalTotal * (1 - promotion.percent / 100);
      break;
    case 'fixedPrice':
      finalTotal = promotion.price * quantity;
      break;
    case 'buyXPayY': {
      const fullGroups = Math.floor(quantity / promotion.buy);
      const remainder = quantity % promotion.buy;
      const payableUnits = fullGroups * promotion.pay + remainder;
      finalTotal = product.price * payableUnits;
      break;
    }
  }

  return {
    originalTotal,
    finalTotal,
    savings: Math.max(0, originalTotal - finalTotal),
  };
}

export type CartTotals = {
  itemCount: number;
  originalTotal: number;
  finalTotal: number;
  savings: number;
};

export function computeCartTotals(items: CartItem[]): CartTotals {
  return items.reduce<CartTotals>(
    (acc, item) => {
      const line = computeLineTotal(item);
      return {
        itemCount: acc.itemCount + item.quantity,
        originalTotal: acc.originalTotal + line.originalTotal,
        finalTotal: acc.finalTotal + line.finalTotal,
        savings: acc.savings + line.savings,
      };
    },
    { itemCount: 0, originalTotal: 0, finalTotal: 0, savings: 0 },
  );
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
