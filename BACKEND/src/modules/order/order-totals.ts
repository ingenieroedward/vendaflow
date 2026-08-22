// Cálculo de totales de orden — extraído a módulo aparte para que Orders y
// POS usen exactamente la misma fórmula (sin duplicar y arriesgar que diverjan).

export function lineTotal(qty: number, price: number, taxRate: number): number {
  return Math.round(qty * price * (1 + (taxRate || 0) / 100) * 100) / 100;
}

export function computeOrderTotal(items: Array<{ quantity: number; unitPrice: number; taxRate: number }>): number {
  return items.reduce((sum, item) => sum + lineTotal(item.quantity, item.unitPrice, item.taxRate), 0);
}
