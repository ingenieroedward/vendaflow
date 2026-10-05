jest.mock('../product.model', () => ({ Product: { findOne: jest.fn() } }));

import { Product } from '../product.model';
import { productNotFoundError } from '../product-errors';
import { NotFoundError } from '@/core/errors/AppError';

const findOne = Product.findOne as jest.Mock;

describe('productNotFoundError', () => {
  beforeEach(() => findOne.mockReset());

  it('producto eliminado → lo nombra, 404, con sufijo (ID n)', async () => {
    findOne.mockResolvedValue({ name: 'Arroz Diana 500g' });
    const err = await productNotFoundError(327, 5);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('El producto "Arroz Diana 500g" fue eliminado y ya no está disponible (ID 327)');
    // busca incluyendo eliminados y SIEMPRE dentro del tenant
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 327, tenantId: 5 }, paranoid: false }));
  });

  it('producto inexistente (u otro tenant) → mensaje genérico, sin filtrar nombres ajenos', async () => {
    findOne.mockResolvedValue(null);
    const err = await productNotFoundError(999, 5);
    expect(err.message).toBe('El producto ya no existe (ID 999)');
  });

  it('el sufijo es parseable por el frontend', async () => {
    findOne.mockResolvedValue({ name: 'X (ID 1)' }); // nombre con paréntesis no confunde: se toma el último
    const { message } = await productNotFoundError(42, 1);
    const ids = [...message.matchAll(/\(ID (\d+)\)/g)].map(m => Number(m[1]));
    expect(ids[ids.length - 1]).toBe(42);
  });
});

describe('archivedProductCode', () => {
  // import tardío: el mock de product.model de arriba no le afecta (función pura)
  const { archivedProductCode } = jest.requireActual('../product-errors') as typeof import('../product-errors');

  it('marca el código y lo hace único por id', () => {
    expect(archivedProductCode('327', 156)).toBe('327 (eliminado #156)');
    expect(archivedProductCode('327', 157)).not.toBe(archivedProductCode('327', 156));
  });

  it('nunca supera STRING(255), aun con códigos largos', () => {
    const out = archivedProductCode('X'.repeat(300), 999999);
    expect(out.length).toBeLessThanOrEqual(255);
    expect(out.endsWith(' (eliminado #999999)')).toBe(true);
  });

  it('libera el código original (el archivado ya no es igual)', () => {
    expect(archivedProductCode('ABC-1', 1)).not.toBe('ABC-1');
  });
});
