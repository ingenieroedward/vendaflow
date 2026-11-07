import { z } from 'zod';

// Login DTO
export const loginSchema = z.object({
  totp: z.string().max(10).optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').max(255),
  // Login acepta contraseñas existentes de 6-7 caracteres; el mínimo de 8 (v1.17.0)
  // aplica solo a contraseñas nuevas (user.dto, creación de tenant)
  password: z.string().min(1, 'La contraseña es requerida'),
  tenantSlug: z.string().optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;

// Register DTO
export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(255),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['buyer', 'admin']).default('buyer'),
});

export type RegisterDto = z.infer<typeof registerSchema>;

// JWT Payload
export interface JwtPayload {
  userId: number;
  username: string;
  role: 'buyer' | 'admin' | 'seller' | 'superadmin';
  tenantId: number;
  tv?: number; // tokenVersion del usuario al emitir (ausente en tokens previos a v1.16.9 = 0)
}