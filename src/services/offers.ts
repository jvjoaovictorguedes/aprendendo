import type { Product } from '../types';
import { apiRequest } from './api';
export type Store = {
  id: string;
  name: string;
  address: string | null;
  hours: string | null;
  active: boolean;
};
export type Offer = {
  id: string;
  productId: string;
  label: string;
  audience: 'all' | 'club';
  kind: 'percent_off' | 'buy_x_pay_y' | 'fixed_price';
  percent: number | null;
  buy: number | null;
  pay: number | null;
  price: number | null;
  storeId: string | null;
  storeName: string | null;
  startsAt: string;
  endsAt: string | null;
  maxQuantity: number | null;
  conditions: string;
  active: boolean;
  product: Product;
};
export type OfferDraft = Omit<Offer, 'id' | 'product' | 'storeName'> & {
  id?: string;
};
export type Loyalty = {
  pointsPerReal: number;
  enabled: boolean;
  rewardName: string;
  pointsRequired: number;
  conditions: string;
};
export type Reward = {
  id: string;
  rewardName: string;
  pointsSpent: number;
  conditions: string;
  redeemedAt: string | null;
  customerName?: string;
};
export const defaultLoyalty: Loyalty = {
  pointsPerReal: 1,
  enabled: false,
  rewardName: '',
  pointsRequired: 1000,
  conditions: '',
};
export const listOffers = (storeId: string | null) =>
  apiRequest<Offer[]>('/public/offers', { tenant: true, query: { storeId } });
export const listStores = () => apiRequest<Store[]>('/public/stores', { tenant: true });
export const listAdminOffers = (id: string) =>
  apiRequest<Offer[]>(`/admin/tenants/${id}/offers`, { auth: 'admin' });
export const listAdminStores = (id: string) =>
  apiRequest<Store[]>(`/admin/tenants/${id}/stores`, { auth: 'admin' });
export const saveOffer = (tenantId: string, draft: OfferDraft) => {
  const { id, ...body } = draft;
  return apiRequest<Offer>(`/admin/tenants/${tenantId}/offers${id ? '/' + id : ''}`, {
    auth: 'admin',
    method: id ? 'PUT' : 'POST',
    body,
  });
};
export const archiveOffer = (tenantId: string, id: string) =>
  apiRequest(`/admin/tenants/${tenantId}/offers/${id}`, {
    auth: 'admin',
    method: 'DELETE',
  });
export const saveStore = (tenantId: string, draft: Omit<Store, 'id'> & { id?: string }) => {
  const { id, ...body } = draft;
  return apiRequest<Store>(`/admin/tenants/${tenantId}/stores${id ? '/' + id : ''}`, {
    auth: 'admin',
    method: id ? 'PUT' : 'POST',
    body,
  });
};
export const fetchLoyalty = (tenantId?: string) =>
  apiRequest<Loyalty>(tenantId ? `/admin/tenants/${tenantId}/loyalty` : '/public/loyalty', {
    auth: tenantId ? 'admin' : undefined,
    tenant: !tenantId,
  });
export const saveLoyalty = (tenantId: string, body: Loyalty) =>
  apiRequest<Loyalty>(`/admin/tenants/${tenantId}/loyalty`, {
    auth: 'admin',
    method: 'PUT',
    body,
  });
export const listRewards = (token: string) =>
  apiRequest<Reward[]>('/customer/rewards', { auth: token });
export const redeemPoints = (token: string, requestKey: string) =>
  apiRequest<Reward>('/customer/rewards', {
    auth: token,
    method: 'POST',
    body: { requestKey },
  });
export const listAdminRewards = (tenantId: string) =>
  apiRequest<Reward[]>(`/admin/tenants/${tenantId}/rewards`, { auth: 'admin' });
export const confirmReward = (tenantId: string, rewardId: string) =>
  apiRequest(`/admin/tenants/${tenantId}/rewards/${rewardId}/redeem`, {
    auth: 'admin',
    method: 'POST',
  });

export const creditPoints = (
  tenantId: string,
  body: { cpf: string; receipt: string; total: number },
) =>
  apiRequest<{ points: number }>(`/admin/tenants/${tenantId}/loyalty/credits`, {
    auth: 'admin',
    method: 'POST',
    body,
  });
