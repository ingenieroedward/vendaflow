import { Router } from 'express';
import { AuthController } from './auth.controller';
import { isAuth } from '@/core/middlewares/auth';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/me', isAuth, authController.getCurrentUser);

export default router; 