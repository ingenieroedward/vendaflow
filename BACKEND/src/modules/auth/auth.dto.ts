import { z } from 'zod';

// Login DTO
export const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginDto = z.infer<typeof loginSchema>;

// Register DTO
export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['buyer', 'admin']).default('buyer'),
});

export type RegisterDto = z.infer<typeof registerSchema>;

// JWT Payload
export interface JwtPayload {
  userId: number;
  username: string;
  role: 'buyer' | 'admin' | 'seller' | 'superadmin';
  tenantId: number;
}