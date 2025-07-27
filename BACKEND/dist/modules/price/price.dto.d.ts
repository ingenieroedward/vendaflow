import { z } from 'zod';
export declare const createPriceSchema: z.ZodObject<{
    productId: z.ZodNumber;
    supplierId: z.ZodNumber;
    price: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    productId: number;
    supplierId: number;
    price: number;
}, {
    productId: number;
    supplierId: number;
    price: number;
}>;
export type CreatePriceDto = z.infer<typeof createPriceSchema>;
export declare const updatePriceSchema: z.ZodObject<{
    price: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    price: number;
}, {
    price: number;
}>;
export type UpdatePriceDto = z.infer<typeof updatePriceSchema>;
export interface PriceResponseDto {
    id: number;
    productId: number;
    supplierId: number;
    price: number;
    updatedByUserId: number;
    product?: {
        id: number;
        name: string;
        unit: string;
    };
    supplier?: {
        id: number;
        name: string;
        contact: string;
        location: string;
    };
    updatedByUser?: {
        id: number;
        username: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface PricesListResponseDto {
    prices: PriceResponseDto[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
//# sourceMappingURL=price.dto.d.ts.map