import { z } from 'zod';
export declare const createUserSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["buyer", "admin", "seller"]>>;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
    role: "buyer" | "seller" | "admin";
}, {
    username: string;
    password: string;
    role?: "buyer" | "seller" | "admin" | undefined;
}>;
export declare const updateUserSchema: z.ZodObject<{
    username: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["buyer", "admin", "seller"]>>;
    password: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    username?: string | undefined;
    password?: string | undefined;
    role?: "buyer" | "seller" | "admin" | undefined;
}, {
    username?: string | undefined;
    password?: string | undefined;
    role?: "buyer" | "seller" | "admin" | undefined;
}>;
export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export interface UserResponseDto {
    id: number;
    username: string;
    role: 'buyer' | 'admin' | 'seller';
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
//# sourceMappingURL=user.dto.d.ts.map