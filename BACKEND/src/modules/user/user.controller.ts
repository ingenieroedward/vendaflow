import { Request, Response } from 'express';
import { UserService } from './user.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { validateSchema, idParamSchema, IdParam } from '@/core/utils/validation';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // GET /api/users
  getAllUsers = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.userService.getAllUsers(req.query as any);
    res.status(200).json({
      status: 'success',
      data: result.users,
      pagination: result.pagination,
    });
  });

  // GET /api/users/:id
  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateSchema(idParamSchema, req.params) as IdParam;
    const user = await this.userService.getUserById(id);
    res.status(200).json({
      status: 'success',
      data: user,
    });
  });

  // POST /api/users
  createUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.userService.createUser(req.body);
    res.status(201).json({
      status: 'success',
      data: user,
    });
  });

  // PUT /api/users/:id
  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateSchema(idParamSchema, req.params) as IdParam;
    const user = await this.userService.updateUser(id, req.body);
    res.status(200).json({
      status: 'success',
      data: user,
    });
  });

  // DELETE /api/users/:id
  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateSchema(idParamSchema, req.params) as IdParam;
    await this.userService.deleteUser(id);
    res.status(204).send();
  });

  // GET /api/users/:id/restore
  restoreUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateSchema(idParamSchema, req.params) as IdParam;
    const user = await this.userService.restoreUser(id)
    res.status(200).json({
      status: 'success',
      data: user,
    });
  })
} 