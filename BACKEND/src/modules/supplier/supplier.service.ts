import { Supplier, SupplierAttributes } from './supplier.model';
import { CreateSupplierDto, UpdateSupplierDto, SupplierResponseDto, SuppliersListResponseDto } from './supplier.dto';
import { NotFoundError, ConflictError } from '@/core/errors/AppError';
import { validateSchema, validatePartialSchema, paginationSchema, PaginationQuery } from '@/core/utils/validation';
import { createSupplierSchema, updateSupplierSchema } from './supplier.dto';

export class SupplierService {
  async createSupplier(supplierData: CreateSupplierDto, tenantId: number): Promise<SupplierResponseDto> {
    const validatedData = validateSchema(createSupplierSchema, supplierData);

    const existingSupplier = await Supplier.findOne({ where: { tenantId, name: validatedData.name } });
    if (existingSupplier) {
      throw new ConflictError('Supplier with this name already exists');
    }

    const supplier = await Supplier.create({ ...validatedData, tenantId } as SupplierAttributes);
    return this.mapToResponseDto(supplier);
  }

  async getAllSuppliers(query: PaginationQuery, tenantId: number): Promise<SuppliersListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Supplier.findAndCountAll({
      where: { tenantId },
      limit: validatedLimit,
      offset,
      order: [['name', 'ASC']],
    });

    const suppliers = rows.map(supplier => this.mapToResponseDto(supplier));
    const totalPages = Math.ceil(Number(count) / validatedLimit);

    return {
      suppliers,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages,
      },
    };
  }

  async getSupplierById(id: number, tenantId: number): Promise<SupplierResponseDto> {
    const supplier = await Supplier.findOne({ where: { id, tenantId } });
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }
    return this.mapToResponseDto(supplier);
  }

  async updateSupplier(id: number, updateData: UpdateSupplierDto, tenantId: number): Promise<SupplierResponseDto> {
    const validatedData = validatePartialSchema(updateSupplierSchema, updateData) as Partial<UpdateSupplierDto>;

    const supplier = await Supplier.findOne({ where: { id, tenantId } });
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    if (validatedData.name && validatedData.name !== supplier.name) {
      const existingSupplier = await Supplier.findOne({ where: { tenantId, name: validatedData.name } });
      if (existingSupplier) {
        throw new ConflictError('Supplier with this name already exists');
      }
    }

    await supplier.update(validatedData as any);
    return this.mapToResponseDto(supplier);
  }

  async deleteSupplier(id: number, tenantId: number): Promise<void> {
    const supplier = await Supplier.findOne({ where: { id, tenantId } });
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }
    await supplier.destroy();
  }

  private mapToResponseDto(supplier: Supplier): SupplierResponseDto {
    return {
      id: supplier.id,
      name: supplier.name,
      contact: supplier.contact,
      location: supplier.location,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    };
  }
}
