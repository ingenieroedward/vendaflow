import { Category, CategoryAttributes } from './category.model';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto, CategoriesListResponseDto } from './category.dto';
import { NotFoundError, ConflictError } from '@/core/errors/AppError';
import { validateSchema, validatePartialSchema, paginationSchema, PaginationQuery } from '@/core/utils/validation';
import { createCategorySchema, updateCategorySchema } from './category.dto';

export class CategoryService {
  async createCategory(categoryData: CreateCategoryDto): Promise<CategoryResponseDto> {
    const validatedData = validateSchema(createCategorySchema, categoryData);

    // Check if category already exists
    const existingCategory = await Category.findOne({ where: { name: validatedData.name } });
    if (existingCategory) {
      throw new ConflictError('Category with this name already exists');
    }

    const category = await Category.create(validatedData as CategoryAttributes);
    return this.mapToResponseDto(category);
  }

  async getAllCategories(query: PaginationQuery): Promise<CategoriesListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Category.findAndCountAll({
      limit: validatedLimit,
      offset,
      order: [['name', 'ASC']],
    });

    const categories = rows.map(category => this.mapToResponseDto(category));
    const totalPages = Math.ceil(Number(count) / validatedLimit);

    return {
      categories,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages,
      },
    };
  }

  async getCategoryById(id: number): Promise<CategoryResponseDto> {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return this.mapToResponseDto(category);
  }

  async updateCategory(id: number, updateData: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const validatedData = validatePartialSchema(updateCategorySchema, updateData) as Partial<UpdateCategoryDto>;

    const category = await Category.findByPk(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if name is being updated and if it already exists
    if (validatedData.name && validatedData.name !== category.name) {
      const existingCategory = await Category.findOne({ where: { name: validatedData.name } });
      if (existingCategory) {
        throw new ConflictError('Category with this name already exists');
      }
    }

    await category.update(validatedData as any);
    return this.mapToResponseDto(category);
  }

  async deleteCategory(id: number): Promise<void> {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if category is "Sin categoría" (default category)
    if (category.name === 'Sin categoría') {
      throw new ConflictError('Cannot delete the default category');
    }

    await category.destroy();
  }

  private mapToResponseDto(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
} 