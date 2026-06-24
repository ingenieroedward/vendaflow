import { StockMovement, MovementType, ReferenceType } from './stock-movement.model';
import { Product } from '@/modules/product/product.model';
import { Transaction } from 'sequelize';
import { paginationSchema, PaginationQuery, validateSchema } from '@/core/utils/validation';

export interface CreateMovementData {
  productId: number;
  type: MovementType;
  quantity: number;
  referenceId?: number | null;
  referenceType?: ReferenceType | null;
  userId: number;
  notes?: string | null;
  transaction?: Transaction | null;
}

export class StockMovementService {
  async createMovement(data: CreateMovementData): Promise<StockMovement> {
    const t = data.transaction ?? null;
    const product = await Product.findByPk(data.productId, { transaction: t });
    if (!product) throw new Error(`Product ${data.productId} not found`);

    const stockBefore = Number(product.stock);
    const stockAfter = stockBefore + data.quantity;

    await product.update({ stock: stockAfter }, { transaction: t });

    return StockMovement.create(
      {
        productId: data.productId,
        type: data.type,
        quantity: data.quantity,
        stockBefore,
        stockAfter,
        referenceId: data.referenceId ?? null,
        referenceType: data.referenceType ?? null,
        userId: data.userId,
        notes: data.notes ?? null,
      },
      { transaction: t },
    );
  }

  async getMovementsByProduct(productId: number, query: PaginationQuery) {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 20;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await StockMovement.findAndCountAll({
      where: { productId },
      order: [['createdAt', 'DESC']],
      limit: validatedLimit,
      offset,
    });

    return {
      movements: rows,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / validatedLimit),
      },
    };
  }

  async getAllMovements(query: PaginationQuery) {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 20;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await StockMovement.findAndCountAll({
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'code', 'unit'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: validatedLimit,
      offset,
    });

    return {
      movements: rows,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / validatedLimit),
      },
    };
  }
}
