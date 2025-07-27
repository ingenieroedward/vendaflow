import { z } from 'zod';
export declare const validateSchema: <T>(schema: z.ZodSchema<T>, data: unknown) => T;
export declare const validatePartialSchema: <T>(schema: z.ZodObject<any>, data: unknown) => Partial<T>;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: number | undefined;
    limit?: number | undefined;
}>;
export declare const idParamSchema: z.ZodObject<{
    id: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
}, {
    id: number;
}>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
//# sourceMappingURL=validation.d.ts.map