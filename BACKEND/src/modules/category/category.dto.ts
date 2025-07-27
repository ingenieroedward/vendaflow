import { z } from 'zod';

// Create Category DTO
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

// Update Category DTO
export const updateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
});

export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

// Category Response DTO
export interface CategoryResponseDto {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// Categories List Response DTO
export interface CategoriesListResponseDto {
  categories: CategoryResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} 