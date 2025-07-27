import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
}, {
    username: string;
    password: string;
}>;
export type LoginDto = z.infer<typeof loginSchema>;
export declare const registerSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["buyer", "admin"]>>;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
    role: "buyer" | "admin";
}, {
    username: string;
    password: string;
    role?: "buyer" | "admin" | undefined;
}>;
export type RegisterDto = z.infer<typeof registerSchema>;
export interface JwtPayload {
    userId: number;
    username: string;
    role: 'buyer' | 'admin' | 'seller';
}
//# sourceMappingURL=auth.dto.d.ts.map