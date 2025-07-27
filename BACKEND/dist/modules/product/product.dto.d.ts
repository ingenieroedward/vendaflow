import { z } from 'zod';
export declare const createProductSchema: z.ZodObject<{
    name: z.ZodString;
    code: z.ZodString;
    unit: z.ZodString;
    salePrice: z.ZodNumber;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    code: string;
    unit: string;
    salePrice: number;
    categoryId?: number | null | undefined;
}, {
    name: string;
    code: string;
    unit: string;
    salePrice: number;
    categoryId?: number | null | undefined;
}>;
export type CreateProductDto = z.infer<typeof createProductSchema>;
export declare const updateProductSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    unit: z.ZodOptional<z.ZodString>;
    salePrice: z.ZodOptional<z.ZodNumber>;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    code?: string | undefined;
    unit?: string | undefined;
    salePrice?: number | undefined;
    categoryId?: number | null | undefined;
}, {
    name?: string | undefined;
    code?: string | undefined;
    unit?: string | undefined;
    salePrice?: number | undefined;
    categoryId?: number | null | undefined;
}>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export declare const searchProductSchema: z.ZodObject<{
    q: z.ZodString;
}, "strip", z.ZodTypeAny, {
    q: string;
}, {
    q: string;
}>;
export type SearchProductDto = z.infer<typeof searchProductSchema>;
export interface ProductResponseDto {
    id: number;
    name: string;
    code: string;
    unit: string;
    salePrice: number;
    categoryId: number | null;
    category?: {
        id: number;
        name: string;
    } | undefined;
    prices?: Array<{
        id: number;
        price: number;
        supplier: {
            id: number;
            name: string;
            contact: string;
            location: string;
        } | undefined;
        updatedAt: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
}
export interface ProductsListResponseDto {
    products: ProductResponseDto[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
//# sourceMappingURL=product.dto.d.ts.map