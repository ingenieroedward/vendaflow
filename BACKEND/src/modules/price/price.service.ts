import { Price, PriceAttributes } from './price.model';
import { Product } from '@/modules/product/product.model';
import { Supplier } from '@/modules/supplier/supplier.model';
import { User } from '@/modules/user/user.model';
import { CreatePriceDto, UpdatePriceDto, PriceResponseDto, PricesListResponseDto } from './price.dto';
import { NotFoundError, ConflictError } from '@/core/errors/AppError';
import { validateSchema, validatePartialSchema, paginationSchema, PaginationQuery } from '@/core/utils/validation';
import { createPriceSchema, updatePriceSchema } from './price.dto';
import { pushService } from '@/modules/push/push.service';

export class PriceService {
  async createPrice(priceData: CreatePriceDto, userId: number, tenantId: number): Promise<PriceResponseDto> {
    const validatedData = validateSchema(createPriceSchema, priceData);

    const product = await Product.findOne({ where: { id: validatedData.productId, tenantId } });
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const supplier = await Supplier.findOne({ where: { id: validatedData.supplierId, tenantId } });
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    const existingPrice = await Price.findOne({
      where: { tenantId, productId: validatedData.productId, supplierId: validatedData.supplierId },
    });
    if (existingPrice) {
      throw new ConflictError('Price already exists for this product and supplier');
    }

    const price = await Price.create({
      ...validatedData,
      tenantId,
      updatedByUserId: userId,
    } as PriceAttributes);

    pushService.notifyAll(
      '💰 Precio actualizado',
      `${product.name}: $${validatedData.price}`,
      { productId: product.id, price: validatedData.price },
    ).catch(() => {});

    return this.mapToResponseDto(price);
  }

  async getAllPrices(query: PaginationQuery, tenantId: number): Promise<PricesListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Price.findAndCountAll({
      where: { tenantId },
      limit: validatedLimit,
      offset,
      order: [['updatedAt', 'DESC']],
      include: [
        { model: Product, as: 'product' },
        { model: Supplier, as: 'supplier' },
        { model: User, as: 'updatedByUser' },
      ],
    });

    const prices = rows.map(price => this.mapToResponseDto(price));
    const totalPages = Math.ceil(Number(count) / validatedLimit);

    return {
      prices,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages,
      },
    };
  }

  async getPriceById(id: number, tenantId: number): Promise<PriceResponseDto> {
    const price = await Price.findOne({
      where: { id, tenantId },
      include: [
        { model: Product, as: 'product' },
        { model: Supplier, as: 'supplier' },
        { model: User, as: 'updatedByUser' },
      ],
    });
    if (!price) {
      throw new NotFoundError('Price not found');
    }
    return this.mapToResponseDto(price);
  }

  async updatePrice(id: number, updateData: UpdatePriceDto, userId: number, tenantId: number): Promise<PriceResponseDto> {
    const validatedData = validatePartialSchema(updatePriceSchema, updateData) as Partial<UpdatePriceDto>;

    const price = await Price.findOne({ where: { id, tenantId } });
    if (!price) {
      throw new NotFoundError('Price not found');
    }

    if (Number(price.price) === Number(validatedData.price)) {
      return this.mapToResponseDto(price);
    }

    await price.update({
      ...validatedData,
      updatedByUserId: userId,
    } as any);

    const updatedProduct = await Product.findOne({ where: { id: price.productId, tenantId } });
    if (updatedProduct && validatedData.price !== undefined) {
      pushService.notifyAll(
        '💰 Precio actualizado',
        `${updatedProduct.name}: $${validatedData.price}`,
        { productId: updatedProduct.id, price: validatedData.price },
      ).catch(() => {});
    }

    return this.mapToResponseDto(price);
  }

  async deletePrice(id: number, tenantId: number): Promise<void> {
    const price = await Price.findOne({ where: { id, tenantId } });
    if (!price) {
      throw new NotFoundError('Price not found');
    }
    await price.destroy();
  }

  async getPricesByProduct(productId: number, tenantId: number): Promise<PriceResponseDto[]> {
    const prices = await Price.findAll({
      where: { tenantId, productId },
      include: [
        { model: Supplier, as: 'supplier' },
        { model: User, as: 'updatedByUser' },
      ],
      order: [['updatedAt', 'DESC']],
    });
    return prices.map(price => this.mapToResponseDto(price));
  }

  private mapToResponseDto(price: Price): PriceResponseDto {
    return {
      id: price.id,
      productId: price.productId,
      supplierId: price.supplierId,
      price: price.price,
      updatedByUserId: price.updatedByUserId,
      ...(price.product && {
        product: {
          id: price.product.id,
          name: price.product.name,
          unit: price.product.unit,
        }
      }),
      ...(price.supplier && {
        supplier: {
          id: price.supplier.id,
          name: price.supplier.name,
          contact: price.supplier.contact,
          location: price.supplier.location,
        }
      }),
      ...(price.updatedByUser && {
        updatedByUser: {
          id: price.updatedByUser.id,
          username: price.updatedByUser.username,
        }
      }),
      createdAt: price.createdAt,
      updatedAt: price.updatedAt,
    };
  }
}
