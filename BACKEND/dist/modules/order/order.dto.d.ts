import { z } from 'zod';
export declare const orderItemSchema: z.ZodObject<{
    productId: z.ZodNumber;
    quantity: z.ZodNumber;
    taxRate: z.ZodNumber;
    unitPrice: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
}, {
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
}>;
export type OrderItemDto = z.infer<typeof orderItemSchema>;
export declare const createOrderSchema: z.ZodObject<{
    customerId: z.ZodNumber;
    orderNumber: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["pending", "processing", "completed", "cancelled"]>>;
    notes: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodNumber;
        quantity: z.ZodNumber;
        taxRate: z.ZodNumber;
        unitPrice: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        productId: number;
        quantity: number;
        unitPrice: number;
        taxRate: number;
    }, {
        productId: number;
        quantity: number;
        unitPrice: number;
        taxRate: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    customerId: number;
    status: "pending" | "processing" | "completed" | "cancelled";
    items: {
        productId: number;
        quantity: number;
        unitPrice: number;
        taxRate: number;
    }[];
    orderNumber?: string | undefined;
    notes?: string | undefined;
}, {
    customerId: number;
    items: {
        productId: number;
        quantity: number;
        unitPrice: number;
        taxRate: number;
    }[];
    orderNumber?: string | undefined;
    status?: "pending" | "processing" | "completed" | "cancelled" | undefined;
    notes?: string | undefined;
}>;
export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export declare const updateOrderSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["pending", "processing", "completed", "cancelled"]>>;
    notes: z.ZodOptional<z.ZodString>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        productId: z.ZodOptional<z.ZodNumber>;
        quantity: z.ZodOptional<z.ZodNumber>;
        taxRate: z.ZodOptional<z.ZodNumber>;
        unitPrice: z.ZodOptional<z.ZodNumber>;
    } & {
        id: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id?: number | undefined;
        productId?: number | undefined;
        quantity?: number | undefined;
        unitPrice?: number | undefined;
        taxRate?: number | undefined;
    }, {
        id?: number | undefined;
        productId?: number | undefined;
        quantity?: number | undefined;
        unitPrice?: number | undefined;
        taxRate?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "processing" | "completed" | "cancelled" | undefined;
    notes?: string | undefined;
    items?: {
        id?: number | undefined;
        productId?: number | undefined;
        quantity?: number | undefined;
        unitPrice?: number | undefined;
        taxRate?: number | undefined;
    }[] | undefined;
}, {
    status?: "pending" | "processing" | "completed" | "cancelled" | undefined;
    notes?: string | undefined;
    items?: {
        id?: number | undefined;
        productId?: number | undefined;
        quantity?: number | undefined;
        unitPrice?: number | undefined;
        taxRate?: number | undefined;
    }[] | undefined;
}>;
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
export declare const searchOrderSchema: z.ZodObject<{
    q: z.ZodString;
}, "strip", z.ZodTypeAny, {
    q: string;
}, {
    q: string;
}>;
export type SearchOrderDto = z.infer<typeof searchOrderSchema>;
export interface OrderItemResponseDto {
    id: number;
    productId: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    product?: {
        id: number;
        name: string;
        code: string;
        unit: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface OrderResponseDto {
    id: number;
    orderNumber: string;
    customerId: number;
    userId: number;
    totalAmount: number;
    status: 'pending' | 'processing' | 'completed' | 'cancelled';
    notes: string | null;
    customer?: {
        id: number;
        name: string;
        contact: string | null;
        address: string | null;
    };
    user?: {
        id: number;
        username: string;
        role: string;
    };
    items?: OrderItemResponseDto[];
    createdAt: Date;
    updatedAt: Date;
}
export interface OrdersListResponseDto {
    orders: OrderResponseDto[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
//# sourceMappingURL=order.dto.d.ts.map