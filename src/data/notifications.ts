export type NotificationKind = 'coupon' | 'budget' | 'system';

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string; // ISO
  read: boolean;
  kind: NotificationKind;
  target?: 'cart' | 'promotions';
  offerId?: string | null;
};

// Notificações de exemplo para o app piloto — em produção viriam do backend
// do supermercado (cupons prestes a expirar, novidades do clube etc.).
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'seed-coupon-1',
    title: 'Cupom expirando em breve',
    body: '15% off em laticínios expira amanhã. Ative na aba Ofertas antes de perder.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    read: false,
    kind: 'coupon',
  },
  {
    id: 'seed-system-1',
    title: 'Bem-vindo(a) ao clube de pontos',
    body: 'Acumule pontos a cada compra e troque por benefícios exclusivos na aba Conta.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true,
    kind: 'system',
  },
];
