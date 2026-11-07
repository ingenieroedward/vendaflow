import { describe, it, expect } from 'vitest';
import { lineFromProduct, lineTotal } from '../tax';

describe('lineFromProduct', () => {
  it('precio con IVA incluido: desglosa y el total queda igual al precio', () => {
    const l = lineFromProduct({ salePrice: 32000, taxRate: 19, priceIncludesTax: true });
    expect(l.taxRate).toBe(19);
    expect(l.unitPrice).toBeCloseTo(26890.76, 2);
    expect(lineTotal(1, l.unitPrice, l.taxRate)).toBe(32000);
  });

  it('precio sin IVA: el IVA se suma encima', () => {
    const l = lineFromProduct({ salePrice: 32000, taxRate: 19, priceIncludesTax: false });
    expect(l).toEqual({ unitPrice: 32000, taxRate: 19 });
    expect(lineTotal(1, l.unitPrice, l.taxRate)).toBe(38080);
  });

  it('sin dato de inclusión se asume incluido (productos existentes)', () => {
    const l = lineFromProduct({ salePrice: 1190, taxRate: 19 });
    expect(lineTotal(1, l.unitPrice, l.taxRate)).toBe(1190);
  });

  it('exento: precio tal cual', () => {
    expect(lineFromProduct({ salePrice: 5000, taxRate: 0, priceIncludesTax: true })).toEqual({ unitPrice: 5000, taxRate: 0 });
  });
});
