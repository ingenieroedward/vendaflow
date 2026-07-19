import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // POST /api/auth/login
  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.authService.login(req.body);
    res.status(200).json({ status: 'success', data: result });
  });

  // GET /api/auth/me
  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.authService.getCurrentUser(req.user!.id);
    res.status(200).json({ status: 'success', data: user });
  });
}
