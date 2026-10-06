// Design tokens do ScanMercado. Toda tela/componente deve consumir
// daqui em vez de usar valores soltos (cor, espaçamento, radius...).
//
// As cores da marca (brand*) são da franquia: applyBrand() troca antes de
// qualquer tela carregar (ver src/brand/BrandedApp.tsx), então os
// StyleSheet.create das telas já nascem com a cor certa.

export const colors = {
  brand: '#1DB954',
  brandDark: '#179A46',
  brandSoft: '#E8F8ED',

  danger: '#C0392B',
  dangerSoft: '#FBE4E0',

  warning: '#B8750C',
  warningSoft: '#FFF2DC',

  text: '#15181C',
  textMuted: '#62696F',
  textFaint: '#9AA0A6',
  onBrand: '#FFFFFF',

  surface: '#FFFFFF',
  surfaceAlt: '#F6F7F8',
  surfaceSunken: '#EFF1F2',
  surfaceDark: '#15181C',
  border: '#E6E8EA',

  starGold: '#FFD166',

  overlay: 'rgba(10, 12, 14, 0.55)',
};

/** Nome e logo da franquia deste app (padrão: ScanMercado). */
export const brand: { name: string; logoUrl: string | null } = {
  name: 'ScanMercado',
  logoUrl: null,
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function mixHex(hex: string, target: number, amount: number): string {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return (
    '#' +
    channels
      .map((value) => Math.round(value + (target - value) * amount))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** Aplica a marca da franquia. Tem que rodar antes das telas carregarem. */
export function applyBrand(next: { name?: string | null; accentColor?: string | null; logoUrl?: string | null }) {
  if (next.name) brand.name = next.name;
  brand.logoUrl = next.logoUrl ?? null;
  if (next.accentColor && HEX_COLOR.test(next.accentColor)) {
    colors.brand = next.accentColor.toUpperCase();
    colors.brandDark = mixHex(next.accentColor, 0, 0.18);
    colors.brandSoft = mixHex(next.accentColor, 255, 0.9);
  }
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  h1: { fontSize: 22, fontWeight: '800' as const },
  h2: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 12, fontWeight: '500' as const },
};

export const shadow = {
  card: {
    shadowColor: '#0A0C0E',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
};

// Área de toque mínima recomendada (acessibilidade / uso com uma mão)
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
export const minTouchSize = 44;
