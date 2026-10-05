import { describe, it, expect } from 'vitest';
import { extractMissingProductId, removeMissingProduct } from '../missingProduct';

describe('extractMissingProductId', () => {
  it('lee el ID del mensaje del backend', () => {
    expect(extractMissingProductId('El producto "Arroz" fue eliminado y ya no está disponible (ID 327)')).toBe(327);
    expect(extractMissingProductId('El producto ya no existe (ID 9)')).toBe(9);
  });
  it('usa el sufijo final aunque el nombre tenga "(ID n)"', () => {
    expect(extractMissingProductId('El producto "Caja (ID 1)" fue eliminado y ya no está disponible (ID 42)')).toBe(42);
  });
  it('otros errores → null', () => {
    expect(extractMissingProductId('Customer not found')).toBeNull();
    expect(extractMissingProductId('Stock insuficiente (ID 3) para el producto X')).toBeNull();
    expect(extractMissingProductId('')).toBeNull();
  });
});

describe('removeMissingProduct', () => {
  const items = [
    { productId: 327, quantity: 1, product: { name: 'Arroz Diana' } },
    { productId: 12, quantity: 2, product: { name: 'Aceite' } },
  ];
  it('quita el ítem y devuelve su nombre', () => {
    const r = removeMissingProduct('El producto ya no existe (ID 327)', items);
    expect(r?.productName).toBe('Arroz Diana');
    expect(r?.items.map(i => i.productId)).toEqual([12]);
  });
  it('null si el error no es de producto o el ID no está en la orden', () => {
    expect(removeMissingProduct('Error de red', items)).toBeNull();
    expect(removeMissingProduct('El producto ya no existe (ID 5)', items)).toBeNull();
  });
});
