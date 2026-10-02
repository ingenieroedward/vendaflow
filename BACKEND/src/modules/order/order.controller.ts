import { Response } from 'express';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderDto, SearchOrderDto } from './order.dto';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';

export class OrderController {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  createOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderData: CreateOrderDto = req.body;
    const userId = req.user!.id;
    const tenantId = req.user!.tenantId;
    const order = await this.orderService.createOrder(orderData, userId, tenantId);
    res.status(201).json({ status: 'success', data: order });
  });

  getAllOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const result = await this.orderService.getAllOrders(req.query as any, tenantId);
    res.status(200).json({ status: 'success', data: result.orders, pagination: result.pagination });
  });

  getHomeStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await this.orderService.getHomeStats(req.user!.tenantId);
    res.status(200).json({ status: 'success', data: stats });
  });

  getProfitStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await this.orderService.getProfitStats(req.user!.tenantId);
    res.status(200).json({ status: 'success', data: stats });
  });

  getMonthlyReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const month = String(req.query['month'] ?? new Date().toISOString().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ status: 'error', message: 'month debe ser YYYY-MM' });
      return;
    }
    const { filename, buffer } = await this.orderService.getMonthlyReportXlsx(req.user!.tenantId, month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  });

  addPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { amount, notes } = req.body ?? {};
    const result = await this.orderService.addPayment(
      Number(req.params['id']), req.user!.tenantId, req.user!.id, Number(amount), notes,
    );
    res.status(201).json({ status: 'success', data: result });
  });

  deletePayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await this.orderService.deletePayment(
      Number(req.params['id']), Number(req.params['paymentId']), req.user!.tenantId,
    );
    res.status(200).json({ status: 'success', data: result });
  });

  getPayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await this.orderService.getPayments(Number(req.params['id']), req.user!.tenantId);
    res.status(200).json({ status: 'success', data: result });
  });

  markPaid = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const paid = req.body?.paid !== false; // default: marcar pagada
    const order = await this.orderService.markPaid(Number(req.params['id']), req.user!.tenantId, paid);
    res.status(200).json({ status: 'success', data: order });
  });

  getReceivables = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await this.orderService.getReceivables(req.user!.tenantId);
    res.status(200).json({ status: 'success', data });
  });

  getOrderById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const order = await this.orderService.getOrderById(Number(req.params['id']), tenantId);
    res.status(200).json({ status: 'success', data: order });
  });

  updateOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const updateData: UpdateOrderDto = req.body;
    const order = await this.orderService.updateOrder(Number(req.params['id']), updateData, tenantId, req.user!.id);
    res.status(200).json({ status: 'success', data: order });
  });

  deleteOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    await this.orderService.deleteOrder(Number(req.params['id']), tenantId);
    res.status(204).send();
  });

  searchOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const searchData: SearchOrderDto = req.query as any;
    const orders = await this.orderService.searchOrders(searchData, tenantId);
    res.status(200).json({ status: 'success', data: orders });
  });

  getNextOrderNumber = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await this.orderService.getNextOrderNumber(req.user!.tenantId);
    res.status(200).json({ status: 'success', data: result });
  });

  getOrdersByCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const result = await this.orderService.getOrdersByCustomer(Number(req.params['customerId']), req.query as any, tenantId);
    res.status(200).json({ status: 'success', data: result.orders, pagination: result.pagination });
  });

  getDeletedOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const orders = await this.orderService.getDeletedOrders(tenantId);
    res.status(200).json({ status: 'success', data: orders });
  });

  restoreOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const order = await this.orderService.restoreOrder(Number(req.params['id']), tenantId);
    res.status(200).json({ status: 'success', data: order });
  });

  hardDeleteOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    await this.orderService.hardDeleteOrder(Number(req.params['id']), tenantId);
    res.status(204).send();
  });
}
