import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        username: string;
        role: 'buyer' | 'seller' | 'admin';
    };
}
export declare const isAuth: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => Promise<void>;
export declare const isAdmin: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void;
export declare const isBuyer: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void;
export declare const isSeller: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map