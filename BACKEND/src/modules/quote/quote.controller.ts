import { Response } from 'express';
import { QuoteService } from './quote.service';
import { CreateQuoteDto, UpdateQuoteDto, SearchQuoteDto } from './quote.dto';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';

export class QuoteController {
  private quoteService: QuoteService;

  constructor() {
    this.quoteService = new QuoteService();
  }

  createQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const quoteData: CreateQuoteDto = req.body;
    const userId = req.user!.id;
    const tenantId = req.user!.tenantId;
    const quote = await this.quoteService.createQuote(quoteData, userId, tenantId);
    res.status(201).json({ status: 'success', data: quote });
  });

  getAllQuotes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const result = await this.quoteService.getAllQuotes(req.query as any, tenantId);
    res.status(200).json({ status: 'success', data: result.quotes, pagination: result.pagination });
  });

  getQuoteById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const quote = await this.quoteService.getQuoteById(Number(req.params['id']), tenantId);
    res.status(200).json({ status: 'success', data: quote });
  });

  updateQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const updateData: UpdateQuoteDto = req.body;
    const quote = await this.quoteService.updateQuote(Number(req.params['id']), updateData, tenantId);
    res.status(200).json({ status: 'success', data: quote });
  });

  deleteQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    await this.quoteService.deleteQuote(Number(req.params['id']), tenantId);
    res.status(204).send();
  });

  searchQuotes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const searchData: SearchQuoteDto = req.query as any;
    const quotes = await this.quoteService.searchQuotes(searchData, tenantId);
    res.status(200).json({ status: 'success', data: quotes });
  });

  getNextQuoteNumber = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await this.quoteService.getNextQuoteNumber(req.user!.tenantId);
    res.status(200).json({ status: 'success', data: result });
  });

  getQuotesByCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const result = await this.quoteService.getQuotesByCustomer(Number(req.params['customerId']), req.query as any, tenantId);
    res.status(200).json({ status: 'success', data: result.quotes, pagination: result.pagination });
  });

  getDeletedQuotes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const quotes = await this.quoteService.getDeletedQuotes(tenantId);
    res.status(200).json({ status: 'success', data: quotes });
  });

  restoreQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const quote = await this.quoteService.restoreQuote(Number(req.params['id']), tenantId);
    res.status(200).json({ status: 'success', data: quote });
  });

  hardDeleteQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    await this.quoteService.hardDeleteQuote(Number(req.params['id']), tenantId);
    res.status(204).send();
  });

  convertToOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const order = await this.quoteService.convertToOrder(Number(req.params['id']), userId, tenantId);
    res.status(201).json({ status: 'success', data: order });
  });
}
