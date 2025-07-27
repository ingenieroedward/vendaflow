import { Router } from 'express';
import { UserController } from './user.controller';
import { isAuth, isAdmin } from '@/core/middlewares/auth';

const router = Router();
const userController = new UserController();

// Protected routes (admin only)
router.use(isAuth, isAdmin);

// GET /api/users - Get all users with pagination
router.get('/', userController.getAllUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', userController.getUserById);

// POST /api/users - Create new user
router.post('/', userController.createUser);

// PUT /api/users/:id - Update user
router.put('/:id', userController.updateUser);

// DELETE /api/users/:id - Delete user (soft delete)
router.delete('/:id', userController.deleteUser);

// GET /api/users/:id/restore - Restore User
router.get('/:id/restore', userController.restoreUser);

export default router; 