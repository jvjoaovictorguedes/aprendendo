import { z } from 'zod';

// z.guid aceita qualquer id no formato do Postgres (z.uuid exige versão
// RFC e recusaria os ids fixos das franquias de exemplo).
export const uuid = z.guid('Identificador inválido.');

export const tenantIdHeader = z.object({
  'x-tenant-id': z.guid('Informe a franquia do app no header x-tenant-id.'),
});

export const idParams = z.object({ id: uuid });

/** "0123" e "123" são o mesmo PLU. */
export function normalizePlu(plu: string): string {
  return plu.replace(/\D/g, '').replace(/^0+/, '');
}

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('E-mail inválido.'));

export const password = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(200);

export const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use o formato #RRGGBB.');

export const settingsBody = z
  .object({
    scale: z.object({
      enabled: z.boolean(),
      prefix: z.string().regex(/^[0-9]{1,2}$/, 'O prefixo deve ter 1 ou 2 dígitos.'),
      pluLength: z.number().int().min(1).max(6),
      valueType: z.enum(['price', 'weight']),
      valueLength: z.number().int().min(4).max(6),
      valueDecimals: z.number().int().min(0).max(3),
      validateCheckDigit: z.boolean(),
    }),
    budgetWarningPercent: z.number().int().min(50).max(100),
    scanCooldownMs: z.number().int().min(300).max(5000),
  })
  .refine(
    (value) => value.scale.prefix.length + value.scale.pluLength + value.scale.valueLength <= 12,
    { message: 'Prefixo + PLU + valor passam de 12 dígitos — não cabem num EAN-13.', path: ['scale'] },
  );

export const productBody = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome.'),
    category: z.string().trim().min(1, 'Informe a categoria.'),
    barcode: z
      .string()
      .trim()
      .regex(/^([0-9]{8,14})?$/, 'Código de barras deve ter de 8 a 14 dígitos.')
      .nullish()
      .transform((value) => value || null),
    plu: z
      .string()
      .nullish()
      .transform((value) => (value ? normalizePlu(value) || null : null))
      .refine((value) => value === null || /^[1-9][0-9]{0,5}$/.test(value), 'PLU deve ter até 6 dígitos.'),
    price: z.number().min(0, 'Preço inválido.').max(99_999_999),
    unit: z.enum(['un', 'kg']),
    active: z.boolean().default(true),
  })
  .refine((value) => value.barcode || value.plu, {
    message: 'Informe o código de barras, o PLU ou os dois.',
    path: ['barcode'],
  })
  .refine((value) => value.unit !== 'kg' || value.plu, {
    message: 'Produto vendido por kg precisa do PLU da balança.',
    path: ['plu'],
  });
