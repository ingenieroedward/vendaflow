jest.mock('../product.model', () => ({ Product: { findOne: jest.fn() } }));
jest.mock('@/modules/category/category.model', () => ({ Category: {} }));
jest.mock('@/modules/price/price.model', () => ({ Price: {} }));
jest.mock('@/modules/supplier/supplier.model', () => ({ Supplier: {} }));

import { ProductService } from '../product.service';
import { Product } from '../product.model';

const mockFindOne = Product.findOne as jest.Mock;
const service = new ProductService();

describe('getNextCode', () => {
  beforeEach(() => mockFindOne.mockReset());

  it('sugiere el siguiente código numérico: 10001 → 10002', async () => {
    mockFindOne
      .mockResolvedValueOnce({ code: '10001' }) // último producto
      .mockResolvedValueOnce(null); // 10002 libre
    const result = await service.getNextCode(1);
    expect(result.nextCode).toBe('10002');
  });

  it('conserva prefijo y ceros: ASE003 → ASE004', async () => {
    mockFindOne
      .mockResolvedValueOnce({ code: 'ASE003' })
      .mockResolvedValueOnce(null);
    const result = await service.getNextCode(1);
    expect(result.nextCode).toBe('ASE004');
  });

  it('salta códigos ya ocupados', async () => {
    mockFindOne
      .mockResolvedValueOnce({ code: '10001' })
      .mockResolvedValueOnce({ id: 99 }) // 10002 ocupado
      .mockResolvedValueOnce(null); // 10003 libre
    const result = await service.getNextCode(1);
    expect(result.nextCode).toBe('10003');
  });

  it('devuelve null si el último código no termina en dígitos', async () => {
    mockFindOne.mockResolvedValueOnce({ code: 'GENERAL' });
    const result = await service.getNextCode(1);
    expect(result.nextCode).toBeNull();
  });

  it('devuelve null si el tenant no tiene productos', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const result = await service.getNextCode(1);
    expect(result.nextCode).toBeNull();
  });
});
