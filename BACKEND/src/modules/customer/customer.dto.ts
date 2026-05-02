import { z } from 'zod';

// Create Customer DTO
export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  nit: z.string().min(1, 'NIT/Cédula is required').max(20, 'NIT too long').optional().nullable(),
  contact: z.string().max(255, 'Contact too long').optional(),
  address: z.string().max(255, 'Address too long').optional(),
  note: z.string().max(255, 'Note too long').optional(),
});

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

// Update Customer DTO
export const updateCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
  nit: z.string().min(1, 'NIT/Cédula is required').max(20, 'NIT too long').optional(),
  contact: z.string().max(255, 'Contact too long').optional(),
  address: z.string().max(255, 'Address too long').optional(),
  note: z.string().max(255, 'Note too long').optional(),
});

export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

// Search Customer DTO
export const searchCustomerSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
});

export type SearchCustomerDto = z.infer<typeof searchCustomerSchema>;

// Customer Response DTO
export interface CustomerResponseDto {
  id: number;
  name: string;
  nit: string | null;
  contact: string | null;
  address: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Customers List Response DTO
export interface CustomersListResponseDto {
  customers: CustomerResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} 