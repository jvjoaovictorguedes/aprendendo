import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, appTenantId } from './api';
export const DEMO_TENANT = '55555555-5555-4555-8555-555555555555';
export type DemoInfo = {
  enabled: boolean;
  toolsEnabled: boolean;
  products?: {
    name: string;
    price: number;
    barcode: string;
    unit: string;
    plu?: string;
  }[];
  meatLabel?: string;
  customerCpf?: string;
  customerPassword?: string;
};
export const demoStorageKey = (key: string) =>
  appTenantId === DEMO_TENANT ? 'scanmercado:demo:' + key : key;
export const fetchDemo = () => apiRequest<DemoInfo>('/public/demo', { tenant: true });
export const resetDemo = (tenantId: string) =>
  apiRequest(`/admin/tenants/${tenantId}/demo/reset`, {
    method: 'POST',
    auth: 'admin',
    body: { confirmation: 'RESTAURAR DEMONSTRACAO' },
  });
export async function clearDemoDevice() {
  if (appTenantId !== DEMO_TENANT) return;
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(
    keys.filter((k) => k.startsWith('scanmercado:demo:') || k.includes(DEMO_TENANT)),
  );
}
