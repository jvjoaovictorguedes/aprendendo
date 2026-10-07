import { apiRequest } from './api';
export type NotificationPolicy = {
  enabled: boolean;
  timezone: string;
  startHour: number;
  endHour: number;
  cartReminderMinutes: number;
  minimumIntervalMinutes: number;
  minimumPurchases: number;
  purchaseWindowDays: number;
};
export type PolicyResponse = {
  settings: NotificationPolicy;
  defaults: NotificationPolicy;
  serverPushEnabled: boolean;
};
export const fetchNotificationPolicy = () =>
  apiRequest<PolicyResponse>('/admin/notification-settings', { auth: 'admin' });
export const saveNotificationPolicy = (body: NotificationPolicy) =>
  apiRequest<PolicyResponse>('/admin/notification-settings', {
    method: 'PUT',
    auth: 'admin',
    body,
  });
