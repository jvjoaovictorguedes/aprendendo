import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeLineTotal, computeCartTotals, computeCartLines } from '../src/utils/pricing.ts';
const product = {
  barcode: '12345678',
  name: 'Produto',
  price: 10,
  unit: 'un',
  category: 'Teste',
};
const item = (quantity = 1, extra = {}) => ({
  product: { ...product, ...extra },
  quantity,
});
const weighted = (code, weightKg) => ({
  product: {
    ...product,
    unit: 'kg',
    promotion: {
      kind: 'percentOff',
      percent: 20,
      label: '20%',
      maxQuantity: 1,
    },
  },
  quantity: 1,
  weighed: {
    labelCode: code,
    weightKg,
    weightIsEstimated: false,
    labelTotal: weightKg * 10,
  },
});
describe('preços de ofertas e limites', () => {
  it('arredonda meia fração de centavo corretamente após cupom', () => {
    assert.deepEqual(computeLineTotal(item(1, { price: 24.9 }), 25), {
      originalTotal: 24.9,
      finalTotal: 18.68,
      savings: 6.22,
    });
  });
  it('percentual respeita limite por compra', () => {
    assert.deepEqual(
      computeLineTotal(
        item(5, {
          promotion: {
            kind: 'percentOff',
            percent: 20,
            label: '20%',
            maxQuantity: 2,
          },
        }),
      ),
      { originalTotal: 50, finalTotal: 46, savings: 4 },
    );
  });
  it('preço fixo e cupom extra são aplicados sobre o preço correto', () => {
    assert.deepEqual(
      computeLineTotal(
        item(3, {
          promotion: {
            kind: 'fixedPrice',
            price: 5,
            label: '5 reais',
            maxQuantity: 2,
          },
        }),
        10,
      ),
      { originalTotal: 30, finalTotal: 18, savings: 12 },
    );
  });
  it('leve/pague usa grupos completos somente dentro do limite', () => {
    assert.equal(
      computeLineTotal(
        item(8, {
          promotion: {
            kind: 'buyXPayY',
            buy: 3,
            pay: 2,
            label: '3/2',
            maxQuantity: 3,
          },
        }),
      ).finalTotal,
      70,
    );
    assert.equal(
      computeLineTotal(
        item(2, {
          promotion: { kind: 'buyXPayY', buy: 3, pay: 2, label: '3/2' },
        }),
      ).finalTotal,
      20,
    );
  });
  it('ofertas vencidas e futuras não reduzem o total', () => {
    assert.equal(
      computeLineTotal(
        item(1, {
          promotion: {
            kind: 'percentOff',
            percent: 50,
            label: 'expirada',
            endsAt: '2000-01-01T00:00:00Z',
          },
        }),
      ).finalTotal,
      10,
    );
    assert.equal(
      computeLineTotal(
        item(1, {
          promotion: {
            kind: 'percentOff',
            percent: 50,
            label: 'agendada',
            startsAt: '2099-01-01T00:00:00Z',
          },
        }),
      ).finalTotal,
      10,
    );
  });
  it('limite de kg é compartilhado entre etiquetas diferentes', () => {
    const items = [weighted('etiqueta1', 1), weighted('etiqueta2', 1)];
    assert.equal(computeCartTotals(items).finalTotal, 18);
    const lines = computeCartLines(items);
    assert.equal(lines[0].savings + lines[1].savings, 2);
  });
  it('uma etiqueta acima do limite só desconta o peso elegível', () =>
    assert.equal(computeLineTotal(weighted('etiqueta', 2)).finalTotal, 18));
  it('cupons ativados atualizam itens já no carrinho', () => {
    const items = [item(2)];
    assert.equal(computeCartTotals(items).finalTotal, 20);
    assert.equal(computeCartTotals(items, () => 10).finalTotal, 18);
  });
  it('centavos são arredondados por linha e preço promocional não aumenta o total', () => {
    assert.deepEqual(
      computeCartTotals([item(1, { price: 0.1 }), item(1, { barcode: '87654321', price: 0.2 })])
        .finalTotal,
      0.3,
    );
    assert.equal(
      computeLineTotal(
        item(1, {
          promotion: { kind: 'fixedPrice', price: 99, label: 'malformada' },
        }),
      ).finalTotal,
      10,
    );
  });
});
