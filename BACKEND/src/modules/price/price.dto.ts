import { z } from 'zod';

// Create Price DTO
export const createPriceSchema = z.object({
  productId: z.number().int().positive('Product ID must be a positive integer'),
  supplierId: z.number().int().positive('Supplier ID must be a positive integer'),
  price: z.number().positive('Price must be positive'),
});

export type CreatePriceDto = z.infer<typeof createPriceSchema>;

// Update Price DTO
export const updatePriceSchema = z.object({
  price: z.number().positive('Price must be positive'),
});

export type UpdatePriceDto = z.infer<typeof updatePriceSchema>;

// Price Response DTO
export interface PriceResponseDto {
  id: number;
  productId: number;
  supplierId: number;
  price: number;
  updatedByUserId: number;
  product?: {
    id: number;
    name: string;
    unit: string;
  };
  supplier?: {
    id: number;
    name: string;
    contact: string;
    location: string;
  };
  updatedByUser?: {
    id: number;
    username: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Prices List Response DTO
export interface PricesListResponseDto {
  prices: PriceResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} 