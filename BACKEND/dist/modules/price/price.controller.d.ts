import { Request, Response } from 'express';
export declare class PriceController {
    private priceService;
    constructor();
    createPrice: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getAllPrices: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getPriceById: (req: Request, res: Response, next: import("express").NextFunction) => void;
    updatePrice: (req: Request, res: Response, next: import("express").NextFunction) => void;
    deletePrice: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getPricesByProduct: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
//# sourceMappingURL=price.controller.d.ts.map