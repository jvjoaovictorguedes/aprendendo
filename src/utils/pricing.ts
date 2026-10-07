import { CartItem } from '../types';

export type LineTotal = {
  originalTotal: number;
  finalTotal: number;
  savings: number;
};

export function roundCents(value: number): number {
  const cents = value * 100;
  // Correct binary floating-point drift at a half-cent (24.90 × 0.75 = 18.675).
  return Math.round(cents + Number.EPSILON * Math.max(1, Math.abs(cents))) / 100;
}

export function computeLineTotal(item: CartItem, extraPercentOff = 0): LineTotal {
  const { product, quantity, weighed } = item;
  const originalTotal = weighed ? weighed.labelTotal * quantity : product.price * quantity;
  const candidate = product.promotion;
  const now = Date.now();
  const promotion =
    candidate &&
    (!candidate.startsAt || Date.parse(candidate.startsAt) <= now) &&
    (!candidate.endsAt || Date.parse(candidate.endsAt) > now)
      ? candidate
      : undefined;
  let finalTotal = originalTotal;
  const measuredQuantity = weighed ? weighed.weightKg * quantity : quantity;
  const eligible = Math.min(measuredQuantity, promotion?.maxQuantity ?? measuredQuantity);
  const normalEligible = weighed
    ? originalTotal * (eligible / measuredQuantity)
    : product.price * eligible;
  if (promotion) {
    switch (promotion.kind) {
      case 'percentOff':
        finalTotal = originalTotal - (normalEligible * promotion.percent) / 100;
        break;
      case 'fixedPrice':
        finalTotal =
          originalTotal - normalEligible + Math.min(normalEligible, promotion.price * eligible);
        break;
      case 'buyXPayY':
        if (!weighed && product.unit === 'un') {
          finalTotal =
            originalTotal -
            Math.floor(eligible / promotion.buy) * (promotion.buy - promotion.pay) * product.price;
        }
        break;
    }
  }

  // Desconto exclusivo de cliente logado, ativado na aba Promoções,
  // aplicado por cima do preço já promocional (se houver).
  if (extraPercentOff > 0) {
    finalTotal = finalTotal * (1 - Math.min(100, extraPercentOff) / 100);
  }

  // Arredonda por linha, como o PDV faz — evita diferença de centavos no total.
  const roundedOriginal = roundCents(originalTotal);
  const roundedFinal = roundCents(Math.max(0, Math.min(originalTotal, finalTotal)));

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

/** A limit applies to the entire purchase, including separate scale labels. */
export function computeCartLines(
  items: CartItem[],
  getExtraPercentOff?: (barcode: string) => number,
): LineTotal[] {
  const quantities = new Map<string, number>();
  for (const item of items) {
    const quantity = item.quantity * (item.weighed?.weightKg ?? 1);
    quantities.set(item.product.barcode, (quantities.get(item.product.barcode) ?? 0) + quantity);
  }
  return items.map((item) => {
    const promotion = item.product.promotion;
    const quantity = item.quantity * (item.weighed?.weightKg ?? 1);
    const total = quantities.get(item.product.barcode) ?? quantity;
    const adjusted =
      promotion?.maxQuantity && total > promotion.maxQuantity
        ? {
            ...item,
            product: {
              ...item.product,
              promotion: {
                ...promotion,
                maxQuantity: (promotion.maxQuantity * quantity) / total,
              },
            },
          }
        : item;
    return computeLineTotal(adjusted, getExtraPercentOff?.(item.product.barcode) ?? 0);
  });
}

export function computeCartTotals(
  items: CartItem[],
  getExtraPercentOff?: (barcode: string) => number,
): CartTotals {
  const lines = computeCartLines(items, getExtraPercentOff);
  return items.reduce<CartTotals>(
    (acc, item, index) => {
      const line = lines[index];
      return {
        itemCount: acc.itemCount + item.quantity,
        originalTotal: roundCents(acc.originalTotal + line.originalTotal),
        finalTotal: roundCents(acc.finalTotal + line.finalTotal),
        savings: roundCents(acc.savings + line.savings),
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

/** "1.234,56", "8,99" ou "8.99" → número; NaN se inválido. */
export function parseDecimal(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') return NaN;
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  return Number(normalized);
}
