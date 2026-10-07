import { z } from 'zod';
import { uuid } from './validation.js';
import type { PromotionRow, ProductRow } from './mappers.js';
import { toAppProduct } from './mappers.js';

export const offerBody = z
  .object({
    productId: uuid,
    label: z.string().trim().min(1).max(120),
    audience: z.enum(['all', 'club']),
    kind: z.enum(['percent_off', 'buy_x_pay_y', 'fixed_price']),
    percent: z.number().gt(0).max(100).multipleOf(0.01).nullable().default(null),
    buy: z.number().int().min(2).max(1000).nullable().default(null),
    pay: z.number().int().min(1).nullable().default(null),
    price: z.number().min(0).max(99999999).multipleOf(0.01).nullable().default(null),
    storeId: uuid.nullable().default(null),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    maxQuantity: z.number().gt(0).max(999999).multipleOf(0.001).nullable().default(null),
    conditions: z.string().trim().max(2000).default(''),
    active: z.boolean(),
  })
  .superRefine((b, ctx) => {
    const error = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (Date.parse(b.endsAt) <= Date.parse(b.startsAt)) error('O fim deve ser depois do início.');
    if (b.kind === 'percent_off' && b.percent === null) error('Informe o percentual.');
    if (b.kind === 'fixed_price' && b.price === null) error('Informe o preço promocional.');
    if (b.kind === 'buy_x_pay_y' && (b.buy === null || b.pay === null || b.pay >= b.buy))
      error('Leve deve ser maior que pague.');
    if (b.audience === 'club' && b.kind !== 'percent_off')
      error('Ofertas do clube usam desconto percentual extra.');
    if (b.kind === 'buy_x_pay_y' && b.maxQuantity !== null && b.maxQuantity % b.buy! !== 0)
      error('O limite deve ser múltiplo da quantidade leve.');
  });
export type OfferRow = PromotionRow & {
  id: string;
  tenant_id: string;
  product_id: string;
  audience: 'all' | 'club';
  store_id: string | null;
  store_name: string | null;
  conditions: string;
  starts_at: Date;
  ends_at: Date | null;
  active: boolean;
  max_quantity: number | null;
};
export function toOffer(row: OfferRow, product: ProductRow) {
  return {
    id: row.id,
    productId: row.product_id,
    label: row.label,
    audience: row.audience,
    kind: row.kind,
    percent: row.percent,
    buy: row.buy_qty,
    pay: row.pay_qty,
    price: row.fixed_price,
    storeId: row.store_id,
    storeName: row.store_name,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString() ?? null,
    conditions: row.conditions,
    maxQuantity: row.max_quantity,
    active: row.active,
    product: toAppProduct(product, null),
  };
}
export const storeBody = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).default(''),
  hours: z.string().trim().max(200).default(''),
  active: z.boolean(),
});
export const loyaltyBody = z
  .object({
    pointsPerReal: z.number().gt(0).max(100).multipleOf(0.01).default(1),
    enabled: z.boolean(),
    rewardName: z.string().trim().max(120),
    pointsRequired: z.number().int().min(1).max(10000000),
    conditions: z.string().trim().max(2000),
  })
  .refine((b) => !b.enabled || b.rewardName.length > 0, 'Informe o benefício do programa.');
export function toLoyalty(row?: {
  enabled: boolean;
  reward_name: string;
  points_required: number;
  conditions: string;
  points_per_real: number;
}) {
  return {
    pointsPerReal: Number(row?.points_per_real ?? 1),
    enabled: row?.enabled ?? false,
    rewardName: row?.reward_name ?? '',
    pointsRequired: row?.points_required ?? 1000,
    conditions: row?.conditions ?? '',
  };
}
