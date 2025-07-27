import { Request, Response } from 'express';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, UpdateCustomerDto, SearchCustomerDto } from './customer.dto';
import { asyncHandler } from '@/core/middlewares/asyncHandler';

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  createCustomer = asyncHandler(async (req: Request, res: Response) => {
    const customerData: CreateCustomerDto = req.body;
    const customer = await this.customerService.createCustomer(customerData);

    res.status(201).json({
      status: 'success',
      data: customer,
    });
  });

  getAllCustomers = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.customerService.getAllCustomers(req.query as any);

    res.status(200).json({
      status: 'success',
      data: result.customers,
      pagination: result.pagination,
    });
  });

  getCustomerById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const customer = await this.customerService.getCustomerById(Number(id));

    res.status(200).json({
      status: 'success',
      data: customer,
    });
  });

  updateCustomer = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: UpdateCustomerDto = req.body;
    const customer = await this.customerService.updateCustomer(Number(id), updateData);

    res.status(200).json({
      status: 'success',
      data: customer,
    });
  });

  deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.customerService.deleteCustomer(Number(id));

    res.status(204).send();
  });

  searchCustomers = asyncHandler(async (req: Request, res: Response) => {
    const searchData: SearchCustomerDto = req.query as any;
    const customers = await this.customerService.searchCustomers(searchData);

    res.status(200).json({
      status: 'success',
      data: customers,
    });
  });
} 