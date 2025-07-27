import { Request, Response } from 'express';
export declare class CustomerController {
    private customerService;
    constructor();
    createCustomer: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getAllCustomers: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getCustomerById: (req: Request, res: Response, next: import("express").NextFunction) => void;
    updateCustomer: (req: Request, res: Response, next: import("express").NextFunction) => void;
    deleteCustomer: (req: Request, res: Response, next: import("express").NextFunction) => void;
    searchCustomers: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
//# sourceMappingURL=customer.controller.d.ts.map