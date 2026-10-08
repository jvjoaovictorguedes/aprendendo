import { writeFile } from 'node:fs/promises';
import { DEMO_PRODUCTS, ean } from '../demo.js';

// EAN-13: 95 módulos, com zona silenciosa de 12 módulos em cada lado.
const left = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const odd = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
];
const parity = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];
function barcodeSvg(code: string) {
  if (!/^\d{13}$/.test(code) || ean(code.slice(0, 12)) !== code) throw new Error('EAN inválido');
  const bits =
    '101' +
    [...code.slice(1, 7)]
      .map((d, i) => (parity[Number(code[0])][i] === 'L' ? left : odd)[Number(d)])
      .join('') +
    '01010' +
    [...code.slice(7)]
      .map((d) => left[Number(d)].replace(/[01]/g, (b) => (b === '0' ? '1' : '0')))
      .join('') +
    '101';
  const bars = [...bits]
    .map((bit, i) => (bit === '1' ? `<rect x="${i + 12}" y="0" width="1" height="40"/>` : ''))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 119 53" role="img" aria-label="Código ${code}"><rect width="119" height="53" fill="white"/><g fill="black">${bars}</g><text x="59.5" y="50" text-anchor="middle" font-family="monospace" font-size="6">${code}</text></svg>`;
}
const labels = [
  ...DEMO_PRODUCTS.filter((p) => p.unit === 'un').map((p) => ({
    name: p.name,
    code: p.barcode,
    description: `Preço fictício: R$ ${p.price.toFixed(2).replace('.', ',')}`,
  })),
  {
    name: 'Contrafilé · etiqueta por preço',
    code: '2000100019603',
    description: 'Total R$ 19,60 · PLU 100 · R$ 37,90/kg · peso estimado 0,517 kg',
  },
  {
    name: 'Banana Prata · etiqueta por preço',
    code: ean('20' + '00101' + '00686'),
    description: 'Total R$ 6,86 · PLU 101 · R$ 5,49/kg · peso estimado 1,250 kg',
  },
];
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Etiquetas fictícias · Bipou</title><style>body{font-family:Arial;margin:20px;color:#111}main{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.label{border:1px solid #ccc;padding:12px;break-inside:avoid;text-align:center}svg{width:70mm;height:auto;max-width:100%}h2{font-size:16px}p{font-size:12px}@media print{button{display:none}body{margin:0}}</style><h1>Etiquetas de demonstração</h1><p>Dados fictícios. Não usar em caixas reais. Imprima a 100%, sem ajuste de escala. Estes códigos funcionam somente no catálogo da loja de demonstração.</p><button onclick="window.print()">Imprimir etiquetas</button><main>${labels.map((l) => `<section class="label"><h2>${l.name}</h2>${barcodeSvg(l.code)}<p>${l.description}</p></section>`).join('')}</main></html>`;
const output = new URL('../../../docs/ETIQUETAS_DEMO.html', import.meta.url);
await writeFile(output, html);
console.log(`Etiquetas atualizadas em ${output.pathname}`);
