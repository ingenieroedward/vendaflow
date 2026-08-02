import { StockMovement, MovementType, ReferenceType } from './stock-movement.model';
import { Product } from '@/modules/product/product.model';
import { Transaction } from 'sequelize';
import { paginationSchema, PaginationQuery, validateSchema } from '@/core/utils/validation';

export interface CreateMovementData {
  tenantId: number;
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
    // Filtra por tenant (evita mutar stock ajeno) y bloquea la fila dentro de
    // la transacción para que dos ventas simultáneas no pisen el mismo stock
    const product = await Product.findOne({
      where: { id: data.productId, tenantId: data.tenantId },
      transaction: t,
      ...(t ? { lock: t.LOCK.UPDATE } : {}),
    });
    if (!product) throw new Error(`Product ${data.productId} not found`);

    // Los DECIMAL de MySQL llegan como string desde Sequelize — sin coerción,
    // stockBefore + quantity concatena texto ("100" + "5.00" = "1005.00")
    const quantity = Number(data.quantity);
    if (!Number.isFinite(quantity)) throw new Error(`Cantidad inválida para producto ${data.productId}`);
    const stockBefore = Number(product.stock);
    const stockAfter = stockBefore + quantity;

    await product.update({ stock: stockAfter }, { transaction: t });

    return StockMovement.create(
      {
        tenantId: data.tenantId,
        productId: data.productId,
        type: data.type,
        quantity,
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

  async getMovementsByProduct(productId: number, query: PaginationQuery, tenantId: number) {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 20;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await StockMovement.findAndCountAll({
      where: { productId, tenantId },
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

  async getAllMovements(query: PaginationQuery, tenantId: number) {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 20;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await StockMovement.findAndCountAll({
      where: { tenantId },
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
