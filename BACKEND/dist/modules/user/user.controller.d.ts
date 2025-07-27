import { Request, Response } from 'express';
export declare class UserController {
    private userService;
    constructor();
    getAllUsers: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getUserById: (req: Request, res: Response, next: import("express").NextFunction) => void;
    createUser: (req: Request, res: Response, next: import("express").NextFunction) => void;
    updateUser: (req: Request, res: Response, next: import("express").NextFunction) => void;
    deleteUser: (req: Request, res: Response, next: import("express").NextFunction) => void;
    restoreUser: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
//# sourceMappingURL=user.controller.d.ts.map