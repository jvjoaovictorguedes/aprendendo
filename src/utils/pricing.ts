import { CartItem } from '../types';

export type LineTotal = {
  originalTotal: number;
  finalTotal: number;
  savings: number;
};

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeLineTotal(item: CartItem, extraPercentOff = 0): LineTotal {
  const { product, quantity, weighed } = item;
  const originalTotal = weighed ? weighed.labelTotal * quantity : product.price * quantity;
  const promotion = product.promotion;

  let finalTotal = originalTotal;

  if (weighed) {
    // Etiqueta de balança: o preço/kg da promoção vale sobre o peso;
    // "leve X pague Y" não se aplica a produto pesado.
    if (promotion?.kind === 'percentOff') {
      finalTotal = originalTotal * (1 - promotion.percent / 100);
    } else if (promotion?.kind === 'fixedPrice') {
      finalTotal = Math.min(originalTotal, promotion.price * weighed.weightKg * quantity);
    }
  } else if (promotion) {
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
  }

  // Desconto exclusivo de cliente logado, ativado na aba Promoções,
  // aplicado por cima do preço já promocional (se houver).
  if (extraPercentOff > 0) {
    finalTotal = finalTotal * (1 - extraPercentOff / 100);
  }

  // Arredonda por linha, como o PDV faz — evita diferença de centavos no total.
  const roundedOriginal = roundCents(originalTotal);
  const roundedFinal = roundCents(finalTotal);

  return {
    originalTotal: roundedOriginal,
    finalTotal: roundedFinal,
    savings: Math.max(0, roundCents(roundedOriginal - roundedFinal)),
  };
}

export type CartTotals = {
  itemCount: number;
  originalTotal: number;
  finalTotal: number;
  savings: number;
};

export function computeCartTotals(
  items: CartItem[],
  getExtraPercentOff?: (barcode: string) => number,
): CartTotals {
  return items.reduce<CartTotals>(
    (acc, item) => {
      const extraPercentOff = getExtraPercentOff?.(item.product.barcode) ?? 0;
      const line = computeLineTotal(item, extraPercentOff);
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

/** "1,250 kg", ou "≈ 1,250 kg" quando o peso foi calculado a partir do preço. */
export function formatKg(weightKg: number, estimated = false): string {
  const formatted = weightKg.toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return `${estimated ? '≈ ' : ''}${formatted} kg`;
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
