import { Request, Response, NextFunction } from 'express';
export interface ErrorResponse {
    status: string;
    message: string;
    stack?: string;
}
export declare const errorHandler: (error: Error, req: Request, res: Response, _next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response) => void;
//# sourceMappingURL=errorHandler.d.ts.map