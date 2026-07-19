import { Response } from 'express';
import { PriceService } from './price.service';
import { CreatePriceDto, UpdatePriceDto } from './price.dto';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';
import { PaginationQuery } from '@/core/utils/validation';

export class PriceController {
  private priceService: PriceService;

  constructor() {
    this.priceService = new PriceService();
  }

  createPrice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const priceData: CreatePriceDto = req.body;
    const price = await this.priceService.createPrice(priceData, userId, tenantId);
    res.status(201).json({ status: 'success', data: price });
  });

  getAllPrices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const query = req.query as unknown as PaginationQuery;
    const result = await this.priceService.getAllPrices(query, tenantId);
    res.status(200).json({ status: 'success', data: result.prices, pagination: result.pagination });
  });

  getPriceById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const price = await this.priceService.getPriceById(Number(req.params['id']), tenantId);
    res.status(200).json({ status: 'success', data: price });
  });

  updatePrice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const updateData: UpdatePriceDto = req.body;
    const price = await this.priceService.updatePrice(Number(req.params['id']), updateData, userId, tenantId);
    res.status(200).json({ status: 'success', data: price });
  });

  deletePrice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    await this.priceService.deletePrice(Number(req.params['id']), tenantId);
    res.status(204).send();
  });

  getPricesByProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const prices = await this.priceService.getPricesByProduct(Number(req.params['productId']), tenantId);
    res.status(200).json({ status: 'success', data: prices });
  });
}
