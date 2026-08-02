import { Response } from 'express';
import { UserService } from './user.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';
import { validateSchema, idParamSchema, IdParam } from '@/core/utils/validation';

export class UserController {
  changeOwnPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await this.userService.changeOwnPassword(req.user!.id, req.body);
    res.status(200).json({ status: 'success', message: 'Contraseña actualizada' });
  });

  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getAllUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const result = await this.userService.getAllUsers(req.query as any, tenantId);
    res.status(200).json({ status: 'success', data: result.users, pagination: result.pagination });
  });

  getUserById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { id } = validateSchema(idParamSchema, req.params) as IdParam;
    const user = await this.userService.getUserById(id, tenantId);
    res.status(200).json({ status: 'success', data: user });
  });

  createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const user = await this.userService.createUser(req.body, tenantId);
    res.status(201).json({ status: 'success', data: user });
  });

  updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { id } = validateSchema(idParamSchema, req.params) as IdParam;
    const user = await this.userService.updateUser(id, req.body, tenantId);
    res.status(200).json({ status: 'success', data: user });
  });

  deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { id } = validateSchema(idParamSchema, req.params) as IdParam;
    const transferTo = req.query['transferTo'] ? Number(req.query['transferTo']) : undefined;
    await this.userService.deleteUser(id, tenantId, transferTo);
    res.status(204).send();
  });

  restoreUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { id } = validateSchema(idParamSchema, req.params) as IdParam;
    await this.userService.restoreUser(id, tenantId);
    res.status(200).json({ status: 'success', data: null });
  });
}
