import { Router } from 'express';
import { TenantController } from './tenant.controller';
import { isAuth, isAdmin, isSuperAdmin } from '@/core/middlewares/auth';

const router = Router();
const ctrl = new TenantController();

// Public — tenant info by slug (for frontend theming)
router.get('/slug/:slug', ctrl.getBySlug);

// Authenticated — get own tenant info & update theme
router.get('/me', isAuth, ctrl.getMyTenant);
router.put('/me/theme', isAuth, isAdmin, ctrl.updateTheme);

// Super-admin only
router.post('/', isAuth, isSuperAdmin, ctrl.createTenant);
router.get('/', isAuth, isSuperAdmin, ctrl.listAll);
router.put('/:id/suspend', isAuth, isSuperAdmin, ctrl.suspend);
router.put('/:id/activate', isAuth, isSuperAdmin, ctrl.activate);
router.put('/:id', isAuth, isSuperAdmin, ctrl.updateTenant);

export default router;
