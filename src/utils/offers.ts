import { Offer } from '../services/offers';
import type { Promotion } from '../types';
export function offerPromotion(o: Offer): Promotion {
  const details = {
    id: o.id,
    label: o.label,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    maxQuantity: o.maxQuantity,
    conditions: o.conditions,
    storeId: o.storeId,
  };
  if (o.kind === 'percent_off') return { ...details, kind: 'percentOff', percent: o.percent ?? 0 };
  if (o.kind === 'fixed_price') return { ...details, kind: 'fixedPrice', price: o.price ?? 0 };
  return { ...details, kind: 'buyXPayY', buy: o.buy ?? 1, pay: o.pay ?? 1 };
}
export function offerConditions(o: Offer): string {
  return [
    o.storeName ? `Loja: ${o.storeName}` : 'Todas as lojas da rede',
    o.endsAt
      ? `Válida até ${new Date(o.endsAt).toLocaleString('pt-BR')}`
      : 'Sem data de encerramento',
    o.maxQuantity
      ? `Limite por compra: ${o.maxQuantity} ${o.product.unit}`
      : 'Sem limite por compra',
    o.audience === 'club'
      ? 'CPF e ativação necessários. Maior cupom ativo aplicado sobre o preço da oferta geral.'
      : 'Aplicação automática. Se houver várias ofertas gerais, vale a de início mais recente.',
    o.conditions,
  ]
    .filter(Boolean)
    .join(' · ');
}
