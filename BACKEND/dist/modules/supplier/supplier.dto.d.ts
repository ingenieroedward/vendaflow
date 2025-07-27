import { z } from 'zod';
export declare const createSupplierSchema: z.ZodObject<{
    name: z.ZodString;
    contact: z.ZodString;
    location: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    contact: string;
    location: string;
}, {
    name: string;
    contact: string;
    location: string;
}>;
export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;
export declare const updateSupplierSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    contact: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    contact?: string | undefined;
    location?: string | undefined;
}, {
    name?: string | undefined;
    contact?: string | undefined;
    location?: string | undefined;
}>;
export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;
export interface SupplierResponseDto {
    id: number;
    name: string;
    contact: string;
    location: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface SuppliersListResponseDto {
    suppliers: SupplierResponseDto[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
//# sourceMappingURL=supplier.dto.d.ts.map