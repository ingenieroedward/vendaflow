import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // POST /api/auth/register
  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.authService.register(req.body);
    res.status(201).json({
      status: 'success',
      data: result,
    });
  });

  // POST /api/auth/login
  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.authService.login(req.body);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  });

  // GET /api/auth/me
  getCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const user = await this.authService.getCurrentUser(userId);
    res.status(200).json({
      status: 'success',
      data: user,
    });
  });
} 