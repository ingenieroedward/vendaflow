import { Request, Response } from 'express';
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
    const order = await this.orderService.createOrder(orderData, userId);

    res.status(201).json({
      status: 'success',
      data: order,
    });
  });

  getAllOrders = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.orderService.getAllOrders(req.query as any);

    res.status(200).json({
      status: 'success',
      data: result.orders,
      pagination: result.pagination,
    });
  });

  getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = await this.orderService.getOrderById(Number(id));

    res.status(200).json({
      status: 'success',
      data: order,
    });
  });

  updateOrder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: UpdateOrderDto = req.body;
    const order = await this.orderService.updateOrder(Number(id), updateData);

    res.status(200).json({
      status: 'success',
      data: order,
    });
  });

  deleteOrder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.orderService.deleteOrder(Number(id));

    res.status(204).send();
  });

  searchOrders = asyncHandler(async (req: Request, res: Response) => {
    const searchData: SearchOrderDto = req.query as any;
    const orders = await this.orderService.searchOrders(searchData);

    res.status(200).json({
      status: 'success',
      data: orders,
    });
  });

  getNextOrderNumber = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.orderService.getNextOrderNumber();

    res.status(200).json({
      status: 'success',
      data: result,
    });
  });

  getOrdersByCustomer = asyncHandler(async (req: Request, res: Response) => {
    const { customerId } = req.params;
    const result = await this.orderService.getOrdersByCustomer(Number(customerId), req.query as any);

    res.status(200).json({
      status: 'success',
      data: result.orders,
      pagination: result.pagination,
    });
  });

  getDeletedOrders = asyncHandler(async (_req: Request, res: Response) => {
    const orders = await this.orderService.getDeletedOrders();
    res.status(200).json({ status: 'success', data: orders });
  });

  restoreOrder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = await this.orderService.restoreOrder(Number(id));
    res.status(200).json({ status: 'success', data: order });
  });

  hardDeleteOrder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.orderService.hardDeleteOrder(Number(id));
    res.status(204).send();
  });
} 