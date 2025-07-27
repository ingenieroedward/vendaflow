import { z } from 'zod';
export declare const createCustomerSchema: z.ZodObject<{
    name: z.ZodString;
    contact: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    contact?: string | undefined;
    address?: string | undefined;
    note?: string | undefined;
}, {
    name: string;
    contact?: string | undefined;
    address?: string | undefined;
    note?: string | undefined;
}>;
export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export declare const updateCustomerSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    contact: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    contact?: string | undefined;
    address?: string | undefined;
    note?: string | undefined;
}, {
    name?: string | undefined;
    contact?: string | undefined;
    address?: string | undefined;
    note?: string | undefined;
}>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
export declare const searchCustomerSchema: z.ZodObject<{
    q: z.ZodString;
}, "strip", z.ZodTypeAny, {
    q: string;
}, {
    q: string;
}>;
export type SearchCustomerDto = z.infer<typeof searchCustomerSchema>;
export interface CustomerResponseDto {
    id: number;
    name: string;
    contact: string | null;
    address: string | null;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface CustomersListResponseDto {
    customers: CustomerResponseDto[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
//# sourceMappingURL=customer.dto.d.ts.map