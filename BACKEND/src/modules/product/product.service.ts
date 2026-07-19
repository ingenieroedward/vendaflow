import { Product, ProductAttributes } from './product.model';
import { Category } from '@/modules/category/category.model';
import { Price } from '@/modules/price/price.model';
import { Supplier } from '@/modules/supplier/supplier.model';
import {
  CreateProductDto,
  UpdateProductDto,
  AdjustStockDto,
  ProductResponseDto,
  ProductsListResponseDto,
  SearchProductDto
} from './product.dto';
import { NotFoundError } from '@/core/errors/AppError';
import { validateSchema, validatePartialSchema, paginationSchema, PaginationQuery } from '@/core/utils/validation';
import { createProductSchema, updateProductSchema, searchProductSchema, adjustStockSchema } from './product.dto';
import { Op, literal } from 'sequelize';

export class ProductService {
  async createProduct(productData: CreateProductDto, tenantId: number): Promise<ProductResponseDto> {
    const validatedData = validateSchema(createProductSchema, productData);

    if (validatedData.categoryId) {
      const category = await Category.findOne({ where: { id: validatedData.categoryId, tenantId } });
      if (!category) {
        throw new NotFoundError('Category not found');
      }
    }

    const product = await Product.create({ ...validatedData, tenantId } as ProductAttributes);
    return this.mapToResponseDto(product);
  }

  async getAllProducts(query: PaginationQuery, tenantId: number, required_prices: boolean = false): Promise<ProductsListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Product.findAndCountAll({
      where: { tenantId },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
        },
        {
          model: Price,
          as: 'prices',
          required: required_prices,
          include: [
            {
              model: Supplier,
              as: 'supplier',
              attributes: ['id', 'name', 'contact', 'location'],
            },
          ],
          order: [['updatedAt', 'DESC']],
        },
      ],
      limit: validatedLimit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    const products = rows.map(product => this.mapToResponseDto(product));
    const totalPages = Math.ceil(Number(count) / validatedLimit);

    return {
      products,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages,
      },
    };
  }

  async getProductById(id: number, tenantId: number): Promise<ProductResponseDto> {
    const product = await Product.findOne({
      where: { id, tenantId },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
        },
      ],
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return this.mapToResponseDto(product);
  }

  async updateProduct(id: number, updateData: UpdateProductDto, tenantId: number): Promise<ProductResponseDto> {
    const validatedData = validatePartialSchema(updateProductSchema, updateData) as Partial<UpdateProductDto>;

    const product = await Product.findOne({ where: { id, tenantId } });
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (validatedData.categoryId) {
      const category = await Category.findOne({ where: { id: validatedData.categoryId, tenantId } });
      if (!category) {
        throw new NotFoundError('Category not found');
      }
    }

    await product.update(validatedData as any);
    return this.mapToResponseDto(product);
  }

  async deleteProduct(id: number, tenantId: number): Promise<void> {
    const product = await Product.findOne({ where: { id, tenantId } });
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    await Price.destroy({ where: { productId: id, tenantId }, force: true });
    await product.destroy({ force: true });
  }

  async searchProducts(searchData: SearchProductDto, tenantId: number, required_prices: boolean = true): Promise<ProductResponseDto[]> {
    const validatedData = validateSchema(searchProductSchema, searchData);

    const products = await Product.findAll({
      where: {
        tenantId,
        [Op.or]: [
          { name: { [Op.like]: `%${validatedData.q}%` } },
          { code: { [Op.like]: `%${validatedData.q}%` } },
        ],
      },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
        },
        {
          model: Price,
          as: 'prices',
          required: required_prices,
          include: [
            {
              model: Supplier,
              as: 'supplier',
              attributes: ['id', 'name', 'contact', 'location'],
            },
          ],
          order: [['updatedAt', 'DESC']],
        },
      ],
      order: [['name', 'ASC']],
    });

    return products.map(product => this.mapToResponseDto(product));
  }

  async getProductsByCategory(categoryId: number, query: PaginationQuery, tenantId: number): Promise<ProductsListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Product.findAndCountAll({
      where: { tenantId, categoryId },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
        },
      ],
      limit: validatedLimit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    const products = rows.map(product => this.mapToResponseDto(product));
    const totalPages = Math.ceil(Number(count) / validatedLimit);

    return {
      products,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages,
      },
    };
  }

  async getStockAlerts(tenantId: number): Promise<ProductResponseDto[]> {
    const products = await Product.findAll({
      where: {
        tenantId,
        [Op.or]: [
          { stock: { [Op.lte]: literal('minStock') } },
          { stock: { [Op.lte]: 0 } },
        ],
      },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      order: [['stock', 'ASC']],
    });
    return products.map(p => this.mapToResponseDto(p));
  }

  async adjustStock(id: number, data: AdjustStockDto, tenantId: number): Promise<ProductResponseDto> {
    const validatedData = validateSchema(adjustStockSchema, data);
    const product = await Product.findOne({ where: { id, tenantId } });
    if (!product) throw new NotFoundError('Product not found');
    await product.update({ stock: Number(product.stock) + validatedData.quantity });
    return this.mapToResponseDto(product);
  }

  private mapToResponseDto(product: Product): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      code: product.code,
      unit: product.unit,
      salePrice: Number(product.salePrice),
      stock: Number(product.stock),
      minStock: Number(product.minStock),
      categoryId: product.categoryId,
      ...(product.category && {
        category: {
          id: product.category.id,
          name: product.category.name,
        }
      }),
      ...(product.prices && {
        prices: product.prices.map(price => ({
          id: price.id,
          productId: product.id,
          supplierId: price.supplierId,
          price: Number(price.price),
          supplier: price.supplier
            ? {
                id: price.supplier.id,
                name: price.supplier.name,
                contact: price.supplier.contact,
                location: price.supplier.location,
              }
            : undefined,
          createdAt: price.createdAt,
          updatedAt: price.updatedAt,
        }))
      }),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
