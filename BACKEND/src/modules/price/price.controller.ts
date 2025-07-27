import { Request, Response } from 'express';
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
    const priceData: CreatePriceDto = req.body;
    const userId = req.user!.id;
    const price = await this.priceService.createPrice(priceData, userId);

    res.status(201).json({
      status: 'success',
      data: price,
    });
  });

  getAllPrices = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as PaginationQuery ;
    const result = await this.priceService.getAllPrices(query);

    res.status(200).json({
      status: 'success',
      data: result.prices,
      pagination: result.pagination,
    });
  });

  getPriceById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const price = await this.priceService.getPriceById(Number(id));

    res.status(200).json({
      status: 'success',
      data: price,
    });
  });

  updatePrice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const updateData: UpdatePriceDto = req.body;
    const userId = req.user!.id;
    const price = await this.priceService.updatePrice(Number(id), updateData, userId);

    res.status(200).json({
      status: 'success',
      data: price,
    });
  });

  deletePrice = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.priceService.deletePrice(Number(id));

    res.status(204).send();
  });

  getPricesByProduct = asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;
    const prices = await this.priceService.getPricesByProduct(Number(productId));

    res.status(200).json({
      status: 'success',
      data: prices,
    });
  });
} 