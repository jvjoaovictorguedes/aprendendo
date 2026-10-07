import { apiRequest } from './api';
import { CartItem } from '../types';
import { NotificationItem } from '../data/notifications';

export type NotificationPreferences = { cartReminders: boolean; personalizedOffers: boolean };
export const NO_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  cartReminders: false,
  personalizedOffers: false,
};

export function engagementItems(items: CartItem[]) {
  return items.map((item) => ({
    barcode: item.product.barcode,
    quantity: Math.round(item.quantity * (item.weighed?.weightKg ?? 1) * 1000) / 1000,
  }));
}
export const getNotificationPreferences = (token: string) =>
  apiRequest<NotificationPreferences>('/customer/preferences', { auth: token });
export const saveNotificationPreferences = (token: string, body: NotificationPreferences) =>
  apiRequest<NotificationPreferences>('/customer/preferences', {
    method: 'PUT',
    auth: token,
    body,
  });
export const getCustomerNotifications = (token: string) =>
  apiRequest<NotificationItem[]>('/customer/notifications', { auth: token });
export const readCustomerNotification = (token: string, id: string, opened = false) =>
  apiRequest('/customer/notifications/' + id + '/read', {
    method: 'POST',
    auth: token,
    body: { opened },
  });
export const registerPushDevice = (
  token: string,
  body: { installationId: string; token: string; platform: 'android' | 'ios' },
) => apiRequest('/customer/devices', { method: 'PUT', auth: token, body });
export const disablePushDevice = (token: string, installationId: string) =>
  apiRequest('/customer/devices/' + installationId, { method: 'DELETE', auth: token });
export const syncCustomerCart = (
  token: string,
  body: {
    cartKey: string;
    revision: number;
    storeId: string | null;
    items: ReturnType<typeof engagementItems>;
  },
) => apiRequest('/customer/cart', { method: 'PUT', auth: token, body });
export const recordCustomerPurchase = (
  token: string,
  body: {
    requestKey: string;
    cartKey: string;
    storeId: string | null;
    items: ReturnType<typeof engagementItems>;
  },
) =>
  apiRequest<{ id: string; source: 'self_reported' }>('/customer/purchases', {
    method: 'POST',
    auth: token,
    body,
  });
