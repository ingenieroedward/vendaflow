import { z } from 'zod';

// Create Supplier DTO
export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  contact: z.string().min(1, 'Contact is required').max(255, 'Contact too long'),
  location: z.string().min(1, 'Location is required').max(255, 'Location too long'),
});

export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;

// Update Supplier DTO
export const updateSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
  contact: z.string().min(1, 'Contact is required').max(255, 'Contact too long').optional(),
  location: z.string().min(1, 'Location is required').max(255, 'Location too long').optional(),
});

export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;

// Supplier Response DTO
export interface SupplierResponseDto {
  id: number;
  name: string;
  contact: string;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

// Suppliers List Response DTO
export interface SuppliersListResponseDto {
  suppliers: SupplierResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} 