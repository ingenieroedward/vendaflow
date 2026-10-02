import { Response } from 'express';
import { PosService } from './pos.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';

const posService = new PosService();

export class PosController {
  getCurrentSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const session = await posService.getCurrentSession(req.user!.tenantId);
    res.json({ status: 'success', data: session });
  });

  openSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const session = await posService.openSession(req.user!.tenantId, req.user!.id, req.body);
    res.status(201).json({ status: 'success', data: session });
  });

  closeSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const session = await posService.closeSession(req.user!.tenantId, Number(req.params['id']), req.body);
    res.json({ status: 'success', data: session });
  });

  listSessions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const sessions = await posService.listSessions(req.user!.tenantId);
    res.json({ status: 'success', data: sessions });
  });

  sale = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await posService.sale(req.user!.tenantId, req.user!.id, req.body);
    res.status(201).json({ status: 'success', data: order });
  });
}
