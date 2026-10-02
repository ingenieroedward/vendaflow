import { z } from 'zod';

// Validation schemas
export const createUserSchema = z.object({
  name: z.string().max(255).optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['buyer', 'admin', 'seller']).default('buyer'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
});
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const updateUserSchema = z.object({
  name: z.string().max(255).optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').max(255).optional(),
  role: z.enum(['buyer', 'admin', 'seller']).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

// Perfil propio: a propósito NO incluye role ni password (el cambio de
// contraseña ya tiene su propio endpoint con verificación de la actual;
// dejar "role" aquí abriría una escalada de privilegios — cualquier campo
// no declarado en este schema se descarta al validar, sin importar lo que
// venga en el body).
export const updateOwnProfileSchema = z.object({
  name: z.string().max(255).optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').max(255).optional(),
});
export type UpdateOwnProfileDto = z.infer<typeof updateOwnProfileSchema>;

// DTO types
export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

// Response DTOs
export interface UserResponseDto {
  id: number;
  name: string | null;
  username: string;
  role: 'buyer' | 'seller' | 'admin' | 'superadmin';
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
