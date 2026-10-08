import { apiRequest } from './api';
export type UploadedLogo = {
  logoUrl: string;
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
};
export const uploadLogo = (tenantId: string, base64: string) =>
  apiRequest<UploadedLogo>(`/admin/tenants/${tenantId}/logo`, {
    method: 'POST',
    auth: 'admin',
    body: { base64 },
  });
export const removeLogo = (tenantId: string) =>
  apiRequest(`/admin/tenants/${tenantId}/logo`, { method: 'DELETE', auth: 'admin' });
