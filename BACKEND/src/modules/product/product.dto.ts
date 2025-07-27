import { z } from 'zod';

// Create Product DTO
export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  code: z.string().min(1, 'Code is required').max(50, 'Code too long'),
  unit: z.string().min(1, 'Unit is required').max(50, 'Unit too long'),
  salePrice: z.number().min(0, 'Sale price must be positive'),
  categoryId: z.number().nullable().optional(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;

// Update Product DTO
export const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
  code: z.string().min(1, 'Code is required').max(50, 'Code too long').optional(),
  unit: z.string().min(1, 'Unit is required').max(50, 'Unit too long').optional(),
  salePrice: z.number().min(0, 'Sale price must be positive').optional(),
  categoryId: z.number().nullable().optional(),
});

export type UpdateProductDto = z.infer<typeof updateProductSchema>;

// Search Product DTO
export const searchProductSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
});

export type SearchProductDto = z.infer<typeof searchProductSchema>;

// Product Response DTO
export interface ProductResponseDto {
  id: number;
  name: string;
  code: string;
  unit: string;
  salePrice: number;
  categoryId: number | null;
  category?: {
    id: number;
    name: string;
  } | undefined;
  prices?: Array<{
    id: number;
    price: number;
    supplier: {
      id: number;
      name: string;
      contact: string;
      location: string;
    } | undefined;
    updatedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// Products List Response DTO
export interface ProductsListResponseDto {
  products: ProductResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} 