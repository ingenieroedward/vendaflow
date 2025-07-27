import { Request, Response } from 'express';
export declare class ProductController {
    private productService;
    constructor();
    createProduct: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getAllProducts: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getAllProductsPrices: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getProductById: (req: Request, res: Response, next: import("express").NextFunction) => void;
    updateProduct: (req: Request, res: Response, next: import("express").NextFunction) => void;
    deleteProduct: (req: Request, res: Response, next: import("express").NextFunction) => void;
    searchProducts: (req: Request, res: Response, next: import("express").NextFunction) => void;
    searchProductsPrices: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getProductsByCategory: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
//# sourceMappingURL=product.controller.d.ts.map