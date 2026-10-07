// Etiqueta de balança (EAN-13 de peso variável).
//
// A balança do mercado imprime um código montado na hora, com o PLU do
// produto e o valor (preço total ou peso) embutidos:
//
//   2  0123  0  01790  8
//   │  │     │  │      └ dígito verificador
//   │  │     │  └─────── valor (termina sempre na posição 12)
//   │  │     └────────── dígitos livres (dependem do modelo da balança)
//   │  └──────────────── PLU — código do produto cadastrado na balança
//   └─────────────────── prefixo de peso variável
//
// Cada franquia usa um modelo de balança diferente, então o layout inteiro
// é parametrizável (ver TenantSettings / tabela tenant_settings).

import { Product } from '../types';
import { roundCents } from './pricing';

export type ScaleValueType = 'price' | 'weight';

export type ScaleLabelConfig = {
  enabled: boolean;
  prefix: string;
  pluLength: number;
  valueType: ScaleValueType;
  valueLength: number;
  valueDecimals: number;
  validateCheckDigit: boolean;
};

export const DEFAULT_SCALE_CONFIG: ScaleLabelConfig = {
  enabled: true,
  prefix: '2',
  pluLength: 4,
  valueType: 'price',
  valueLength: 5,
  valueDecimals: 2,
  validateCheckDigit: true,
};

/** 20 | 00100 | 01960 | 3: PLU 100, total R$ 19,60. */
export const PRICE_20_SCALE_CONFIG: ScaleLabelConfig = {
  enabled: true,
  prefix: '20',
  pluLength: 5,
  valueType: 'price',
  valueLength: 5,
  valueDecimals: 2,
  validateCheckDigit: true,
};

/** 2 | XXXXX | ZZZZZZ | C: seis dígitos de peso em gramas. */
export const WEIGHT_2_SCALE_CONFIG: ScaleLabelConfig = {
  enabled: true,
  prefix: '2',
  pluLength: 5,
  valueType: 'weight',
  valueLength: 6,
  valueDecimals: 3,
  validateCheckDigit: true,
};

export type ScaleLabel = {
  code: string;
  plu: string;
  valueType: ScaleValueType;
  /** Reais quando valueType = 'price'; kg quando valueType = 'weight'. */
  value: number;
};

const EAN13_BODY_LENGTH = 12;

/** Retorna a mensagem de erro do layout, ou null se ele for válido. */
export function validateScaleConfig(config: ScaleLabelConfig): string | null {
  if (!/^[0-9]{1,2}$/.test(config.prefix)) return 'O prefixo deve ter 1 ou 2 dígitos.';
  if (config.pluLength < 1 || config.pluLength > 6) return 'O PLU deve ter de 1 a 6 dígitos.';
  if (config.valueLength < 4 || config.valueLength > 6) return 'O valor deve ter de 4 a 6 dígitos.';
  if (config.valueDecimals < 0 || config.valueDecimals > 3)
    return 'As casas decimais devem ser de 0 a 3.';
  if (config.prefix.length + config.pluLength + config.valueLength > EAN13_BODY_LENGTH) {
    return 'Prefixo + PLU + valor passam de 12 dígitos — não cabem num EAN-13.';
  }
  return null;
}

export function ean13CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/** "0123" e "123" são o mesmo PLU. */
export function normalizePlu(plu: string): string {
  return plu.replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * Lê uma etiqueta de balança. Retorna null quando o código não é uma
 * etiqueta de balança dessa franquia (aí ele segue como código de barras
 * comum).
 */
export function parseScaleLabel(code: string, config: ScaleLabelConfig): ScaleLabel | null {
  if (!config.enabled || validateScaleConfig(config)) return null;
  if (!/^[0-9]{13}$/.test(code) || !code.startsWith(config.prefix)) return null;

  const body = code.slice(0, EAN13_BODY_LENGTH);
  if (config.validateCheckDigit && ean13CheckDigit(body) !== Number(code[EAN13_BODY_LENGTH])) {
    return null;
  }

  const pluStart = config.prefix.length;
  const plu = normalizePlu(code.slice(pluStart, pluStart + config.pluLength));
  if (!plu) return null;

  const rawValue = Number(body.slice(EAN13_BODY_LENGTH - config.valueLength));
  const value = rawValue / 10 ** config.valueDecimals;

  return { code, plu, valueType: config.valueType, value };
}

/** Etiquetas reconhecidas pelo prefixo não podem cair na busca de produto comum. */
export function readScannerLabel(code: string, config: ScaleLabelConfig): ScaleLabel | null {
  if (!config.enabled || !/^[0-9]{13}$/.test(code) || !code.startsWith(config.prefix)) {
    return null;
  }
  const label = parseScaleLabel(code, config);
  if (!label || label.value <= 0) {
    throw new Error('Etiqueta de balança inválida. Confira o código e a configuração da balança.');
  }
  return label;
}

/** Monta uma etiqueta de exemplo — usado no simulador do admin. */
export function buildScaleLabel(
  plu: string,
  value: number,
  config: ScaleLabelConfig,
): string | null {
  if (validateScaleConfig(config)) return null;
  const pluDigits = normalizePlu(plu).padStart(config.pluLength, '0');
  const valueDigits = String(Math.round(value * 10 ** config.valueDecimals)).padStart(
    config.valueLength,
    '0',
  );
  if (pluDigits.length > config.pluLength || valueDigits.length > config.valueLength) return null;

  const fillerLength =
    EAN13_BODY_LENGTH - config.prefix.length - config.pluLength - config.valueLength;
  const body = config.prefix + pluDigits + '0'.repeat(fillerLength) + valueDigits;
  return body + ean13CheckDigit(body);
}

/**
 * Converte a etiqueta lida no peso e no valor da linha.
 * Etiqueta de preço: o valor é o total; o peso é estimado (total ÷ preço/kg).
 * Etiqueta de peso: o peso é exato; o total é peso × preço/kg.
 */
export function resolveScaleLabel(label: ScaleLabel, product: Pick<Product, 'price'>) {
  if (label.valueType === 'price') {
    return {
      total: roundCents(label.value),
      weightKg: product.price > 0 ? label.value / product.price : 0,
      weightIsEstimated: true,
    };
  }
  return {
    total: roundCents(label.value * product.price),
    weightKg: label.value,
    weightIsEstimated: false,
  };
}
