import { Router } from 'express';
import { AuthController } from './auth.controller';
import { isAuth, isSuperAdmin } from '@/core/middlewares/auth';

const router = Router();
const authController = new AuthController();

// Public routes (register is now via /api/onboarding/register)
router.post('/login', authController.login);

// Protected routes
router.get('/me', isAuth, authController.getCurrentUser);

// 2FA (TOTP) — solo superadmin
router.get('/totp/status', isAuth, isSuperAdmin, authController.totpStatus);
router.post('/totp/setup', isAuth, isSuperAdmin, authController.totpSetup);
router.post('/totp/enable', isAuth, isSuperAdmin, authController.totpEnable);
router.post('/totp/disable', isAuth, isSuperAdmin, authController.totpDisable);

export default router; 