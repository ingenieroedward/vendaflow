export interface ApiResponse<T = any> {
    status: 'success' | 'error';
    data?: T;
    message?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                username: string;
                role: 'buyer' | 'admin' | 'seller';
            };
        }
    }
}
//# sourceMappingURL=index.d.ts.map