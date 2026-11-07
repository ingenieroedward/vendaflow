// Precio e IVA con que un producto entra a una línea de orden/cotización/POS.
// Si el precio de venta YA incluye el IVA, se desglosa: base = precio / (1+IVA)
// para que base + IVA = precio de venta (el cliente paga lo que dice la ficha).
// Si no lo incluye, el IVA se suma encima del precio.
import { Product } from '../types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function lineFromProduct(product: Pick<Product, 'salePrice' | 'taxRate' | 'priceIncludesTax'>): { unitPrice: number; taxRate: number } {
  const price = Number(product.salePrice) || 0;
  const taxRate = Number(product.taxRate ?? 0);
  const included = product.priceIncludesTax !== false; // por defecto el precio incluye IVA
  if (included && taxRate > 0) {
    return { unitPrice: round2(price / (1 + taxRate / 100)), taxRate };
  }
  return { unitPrice: price, taxRate };
}

/** Misma fórmula que el backend (order-totals.ts::lineTotal) */
export function lineTotal(qty: number, unitPrice: number, taxRate: number): number {
  return Math.round(qty * unitPrice * (1 + (taxRate || 0) / 100) * 100) / 100;
}
