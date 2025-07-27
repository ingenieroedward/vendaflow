import { z } from 'zod';
export declare const createCategorySchema: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export declare const updateCategorySchema: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
export interface CategoryResponseDto {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CategoriesListResponseDto {
    categories: CategoryResponseDto[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
//# sourceMappingURL=category.dto.d.ts.map