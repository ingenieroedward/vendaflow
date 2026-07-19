import { Router } from 'express';
import { TenantController } from './tenant.controller';
import { isAuth, isSuperAdmin } from '@/core/middlewares/auth';

const router = Router();
const ctrl = new TenantController();

// Public — tenant info by slug (for frontend theming)
router.get('/slug/:slug', ctrl.getBySlug);

// Authenticated — get own tenant info & update theme
router.get('/me', isAuth, ctrl.getMyTenant);
router.put('/me/theme', isAuth, ctrl.updateTheme);

// Super-admin only
router.get('/', isAuth, isSuperAdmin, ctrl.listAll);
router.put('/:id/suspend', isAuth, isSuperAdmin, ctrl.suspend);
router.put('/:id/activate', isAuth, isSuperAdmin, ctrl.activate);

export default router;
