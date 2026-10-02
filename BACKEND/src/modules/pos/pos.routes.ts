import { Router } from 'express';
import { PosController } from './pos.controller';
import { isAuth, isSeller } from '@/core/middlewares/auth';

const router = Router();
const ctrl = new PosController();

// Todas requieren feature 'pos' (montado en app.ts) + rol vendedor/admin
router.get('/sessions/current', isAuth, isSeller, ctrl.getCurrentSession);
router.get('/sessions', isAuth, isSeller, ctrl.listSessions);
router.post('/sessions', isAuth, isSeller, ctrl.openSession);
router.patch('/sessions/:id/close', isAuth, isSeller, ctrl.closeSession);
router.post('/sale', isAuth, isSeller, ctrl.sale);

export default router;
