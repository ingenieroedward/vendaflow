import { z } from 'zod';
import { ValidationError } from '../errors/AppError';

export const validateSchema = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(err => err.message).join(', ');
      throw new ValidationError(errorMessage);
    }
    throw error;
  }
};

export const validatePartialSchema = <T>(schema: z.ZodObject<any>, data: unknown): Partial<T> => {
  try {
    return schema.partial().parse(data) as Partial<T>;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(err => err.message).join(', ');
      throw new ValidationError(errorMessage);
    }
    throw error;
  }
};

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).default(10),
});

export const idParamSchema = z.object({
  id: z.coerce.number().positive(),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
export type IdParam = z.infer<typeof idParamSchema>; 