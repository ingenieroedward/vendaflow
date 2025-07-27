import { z } from 'zod';

// Validation schemas
export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['buyer', 'admin', 'seller']).default('buyer'),
});

export const updateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(255).optional(),
  role: z.enum(['buyer', 'admin', 'seller']).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

// DTO types
export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

// Response DTOs
export interface UserResponseDto {
  id: number;
  username: string;
  role: 'buyer' | 'admin' | 'seller';
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | undefined;
}

export interface UsersListResponseDto {
  users: UserResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} 