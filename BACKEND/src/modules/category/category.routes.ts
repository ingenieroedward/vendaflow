import { Router } from 'express';
import { CategoryController } from './category.controller';
import { isAuth, isAdmin } from '@/core/middlewares/auth';

const router = Router();
const categoryController = new CategoryController();

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);

// Protected routes (admin only)
router.post('/', isAuth, isAdmin, categoryController.createCategory);
router.put('/:id', isAuth, isAdmin, categoryController.updateCategory);
router.delete('/:id', isAuth, isAdmin, categoryController.deleteCategory);

export default router; 