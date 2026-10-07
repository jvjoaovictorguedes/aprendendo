import { Offer } from '../services/offers';
import type { Promotion } from '../types';
/** Validade no fuso do mercado, independente do fuso do celular. */
export function offerValidity(o: Offer): string {
  if (!o.endsAt) return 'Sem data de encerramento';
  const date = new Date(o.endsAt);
  if (!Number.isFinite(date.getTime())) return 'Consulte a validade na loja';
  const day = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `Até ${day} às ${time} (Brasília)`;
}
export function offerQuantityLimit(o: Offer): string {
  if (o.maxQuantity === null) return 'Sem limite por compra';
  const quantity = o.maxQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  const unit = o.product.unit === 'kg' ? 'kg' : o.maxQuantity === 1 ? 'unidade' : 'unidades';
  return `Até ${quantity} ${unit} por compra`;
}
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
    offerValidity(o),
    offerQuantityLimit(o),
    o.audience === 'club'
      ? 'CPF e ativação necessários. Maior cupom ativo aplicado sobre o preço da oferta geral.'
      : 'Aplicação automática. Se houver várias ofertas gerais, vale a de início mais recente.',
    o.conditions,
  ]
    .filter(Boolean)
    .join(' · ');
}
