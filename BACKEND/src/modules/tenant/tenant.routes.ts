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
router.get('/me/billing', isAuth, isAdmin, ctrl.getBilling);
router.post('/me/payments', isAuth, isAdmin, ctrl.reportPayment);

// Super-admin only
router.post('/', isAuth, isSuperAdmin, ctrl.createTenant);
router.get('/', isAuth, isSuperAdmin, ctrl.listAll);
router.get('/platform/stats', isAuth, isSuperAdmin, ctrl.platformStats);
router.get('/platform/settings', isAuth, isSuperAdmin, ctrl.getPlatformSettings);
router.get('/platform/funnel', isAuth, isSuperAdmin, ctrl.getFunnel);
router.put('/platform/settings', isAuth, isSuperAdmin, ctrl.updatePlatformSettings);
router.get('/requests', isAuth, isSuperAdmin, ctrl.listRequests);
router.get('/payments', isAuth, isSuperAdmin, ctrl.listPayments);
router.get('/payments/:id/receipt', isAuth, isSuperAdmin, ctrl.getPaymentReceipt);
router.post('/payments/:id/approve', isAuth, isSuperAdmin, ctrl.approvePayment);
router.post('/payments/:id/reject', isAuth, isSuperAdmin, ctrl.rejectPayment);
router.post('/requests/:id/approve', isAuth, isSuperAdmin, ctrl.approveRequest);
router.post('/requests/:id/reject', isAuth, isSuperAdmin, ctrl.rejectRequest);
router.post('/broadcast', isAuth, isSuperAdmin, ctrl.broadcast);
router.post('/:id/impersonate', isAuth, isSuperAdmin, ctrl.impersonate);
router.get('/:id/detail', isAuth, isSuperAdmin, ctrl.getDetail);
router.get('/:id/export', isAuth, isSuperAdmin, ctrl.exportData);
router.put('/:id/suspend', isAuth, isSuperAdmin, ctrl.suspend);
router.put('/:id/activate', isAuth, isSuperAdmin, ctrl.activate);
router.put('/:id', isAuth, isSuperAdmin, ctrl.updateTenant);

export default router;
