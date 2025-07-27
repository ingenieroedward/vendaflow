import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto, CategoriesListResponseDto } from './category.dto';
import { PaginationQuery } from '../../core/utils/validation';
export declare class CategoryService {
    createCategory(categoryData: CreateCategoryDto): Promise<CategoryResponseDto>;
    getAllCategories(query: PaginationQuery): Promise<CategoriesListResponseDto>;
    getCategoryById(id: number): Promise<CategoryResponseDto>;
    updateCategory(id: number, updateData: UpdateCategoryDto): Promise<CategoryResponseDto>;
    deleteCategory(id: number): Promise<void>;
    private mapToResponseDto;
}
//# sourceMappingURL=category.service.d.ts.map