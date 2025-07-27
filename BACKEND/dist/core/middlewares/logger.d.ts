import { Request, Response, NextFunction } from 'express';
export declare const httpLogger: (req: import("http").IncomingMessage, res: import("http").ServerResponse<import("http").IncomingMessage>, callback: (err?: Error) => void) => void;
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const errorLogger: (error: Error, req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=logger.d.ts.map