import { Request, Response } from 'express';
import { PurchaseOrderService } from './purchase-order.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';

export class PurchaseOrderController {
  private service = new PurchaseOrderService();

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.['id'];
    const po = await this.service.createPurchaseOrder(req.body, userId);
    res.status(201).json({ status: 'success', data: po });
  });

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.getAllPurchaseOrders(req.query as any);
    res.status(200).json({ status: 'success', data: result.purchaseOrders, pagination: result.pagination });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const po = await this.service.getPurchaseOrderById(Number(req.params['id']));
    res.status(200).json({ status: 'success', data: po });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.['id'];
    const po = await this.service.updatePurchaseOrder(Number(req.params['id']), req.body, userId);
    res.status(200).json({ status: 'success', data: po });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.service.deletePurchaseOrder(Number(req.params['id']));
    res.status(204).send();
  });
}
