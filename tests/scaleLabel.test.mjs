import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PRICE_20_SCALE_CONFIG,
  WEIGHT_2_SCALE_CONFIG,
  buildScaleLabel,
  readScannerLabel,
  resolveScaleLabel,
  validateScaleConfig,
} from '../src/utils/scaleLabel.ts';
import { computeLineTotal } from '../src/utils/pricing.ts';

describe('etiquetas de carne por preço ou peso', () => {
  it('lê a etiqueta real como PLU 100 e R$ 19,60, não R$ 37,90', () => {
    const label = readScannerLabel('2000100019603', PRICE_20_SCALE_CONFIG);
    assert.equal(label.plu, '100');
    assert.equal(label.value, 19.6);
    const resolved = resolveScaleLabel(label, { price: 37.9 });
    assert.equal(resolved.total, 19.6);
    assert.ok(Math.abs(resolved.weightKg - 19.6 / 37.9) < 1e-10);
    assert.equal(resolved.weightIsEstimated, true);
    const item = {
      product: { barcode: 'plu:100', price: 37.9, unit: 'kg' },
      quantity: 1,
      weighed: { labelCode: label.code, labelTotal: resolved.total, ...resolved },
    };
    assert.equal(computeLineTotal(item).finalTotal, 19.6);
    assert.equal(computeLineTotal({ ...item, quantity: 2 }).finalTotal, 39.2);
    // Atualizar o preço/kg não deve substituir o total impresso na etiqueta.
    assert.equal(
      computeLineTotal({ ...item, product: { ...item.product, price: 45 } }).finalTotal,
      19.6,
    );
  });
  it('lê opção B como 1,250 kg e calcula R$ 47,38 a R$ 37,90/kg', () => {
    const code = buildScaleLabel('100', 1.25, WEIGHT_2_SCALE_CONFIG);
    const label = readScannerLabel(code, WEIGHT_2_SCALE_CONFIG);
    assert.equal(label.plu, '100');
    assert.equal(label.value, 1.25);
    assert.deepEqual(resolveScaleLabel(label, { price: 37.9 }), {
      total: 47.38,
      weightKg: 1.25,
      weightIsEstimated: false,
    });
  });
  it('recusa dígito verificador errado e total zero sem buscar como produto comum', () => {
    assert.throws(() => readScannerLabel('2000100019604', PRICE_20_SCALE_CONFIG), /inválida/);
    assert.throws(
      () =>
        readScannerLabel(buildScaleLabel('100', 0, PRICE_20_SCALE_CONFIG), PRICE_20_SCALE_CONFIG),
      /inválida/,
    );
  });
  it('mantém códigos comuns e configuração desativada fora da leitura de balança', () => {
    assert.equal(readScannerLabel('7891000100103', PRICE_20_SCALE_CONFIG), null);
    assert.equal(
      readScannerLabel('2000100019603', { ...PRICE_20_SCALE_CONFIG, enabled: false }),
      null,
    );
  });
  it('não aceita o layout de 14 dígitos descrito inicialmente como EAN-13', () => {
    assert.match(validateScaleConfig({ ...PRICE_20_SCALE_CONFIG, valueLength: 6 }), /12 dígitos/);
    assert.equal(buildScaleLabel('100', 19.6, PRICE_20_SCALE_CONFIG), '2000100019603');
  });
});
