import { Response } from 'express';
import { StockMovementService } from './stock-movement.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';

export class StockMovementController {
  private service = new StockMovementService();

  getAll = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await this.service.getAllMovements(req.query as any, req.user!.tenantId);
    res.status(200).json({ status: 'success', data: result.movements, pagination: result.pagination });
  });

  getByProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await this.service.getMovementsByProduct(
      Number(req.params['productId']),
      req.query as any,
      req.user!.tenantId,
    );
    res.status(200).json({ status: 'success', data: result.movements, pagination: result.pagination });
  });
}
