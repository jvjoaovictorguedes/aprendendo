export type MemberPromotion = {
  id: string;
  barcode: string;
  label: string;
  extraPercentOff: number;
};

// Ofertas exclusivas para cliente logado (estilo "Meu BH" / "Cliente Mais").
// O cliente precisa ativar antes de bipar o produto no caixa.
export const MEMBER_PROMOTIONS: MemberPromotion[] = [
  {
    id: 'mp1',
    barcode: '7891000100103',
    label: 'Cliente ScanMercado: -10% no Arroz Branco 5kg',
    extraPercentOff: 10,
  },
  {
    id: 'mp2',
    barcode: '7891000600108',
    label: 'Cliente ScanMercado: -15% no Papel Higiênico',
    extraPercentOff: 15,
  },
  {
    id: 'mp3',
    barcode: '7891000700109',
    label: 'Cliente ScanMercado: -20% na Maçã Gala',
    extraPercentOff: 20,
  },
  {
    id: 'mp4',
    barcode: '7891000400106',
    label: 'Cliente ScanMercado: -12% no Café Torrado',
    extraPercentOff: 12,
  },
];

export function findMemberPromotionsByBarcode(barcode: string): MemberPromotion[] {
  return MEMBER_PROMOTIONS.filter((promo) => promo.barcode === barcode);
}
