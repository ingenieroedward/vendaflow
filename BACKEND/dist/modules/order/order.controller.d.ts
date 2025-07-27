import { Request, Response } from 'express';
export declare class OrderController {
    private orderService;
    constructor();
    createOrder: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getAllOrders: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getOrderById: (req: Request, res: Response, next: import("express").NextFunction) => void;
    updateOrder: (req: Request, res: Response, next: import("express").NextFunction) => void;
    deleteOrder: (req: Request, res: Response, next: import("express").NextFunction) => void;
    searchOrders: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getNextOrderNumber: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getOrdersByCustomer: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
//# sourceMappingURL=order.controller.d.ts.map