import { Request, Response } from 'express';
export declare class CategoryController {
    private categoryService;
    constructor();
    createCategory: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getAllCategories: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getCategoryById: (req: Request, res: Response, next: import("express").NextFunction) => void;
    updateCategory: (req: Request, res: Response, next: import("express").NextFunction) => void;
    deleteCategory: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
//# sourceMappingURL=category.controller.d.ts.map