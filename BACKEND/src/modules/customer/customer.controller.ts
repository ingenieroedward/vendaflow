import { Response } from 'express';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, UpdateCustomerDto, SearchCustomerDto } from './customer.dto';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  createCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const customerData: CreateCustomerDto = req.body;
    const customer = await this.customerService.createCustomer(customerData, tenantId);
    res.status(201).json({ status: 'success', data: customer });
  });

  getAllCustomers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const result = await this.customerService.getAllCustomers(req.query as any, tenantId);
    res.status(200).json({ status: 'success', data: result.customers, pagination: result.pagination });
  });

  getCustomerById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const customer = await this.customerService.getCustomerById(Number(req.params['id']), tenantId);
    res.status(200).json({ status: 'success', data: customer });
  });

  updateCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const updateData: UpdateCustomerDto = req.body;
    const customer = await this.customerService.updateCustomer(Number(req.params['id']), updateData, tenantId);
    res.status(200).json({ status: 'success', data: customer });
  });

  deleteCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    await this.customerService.deleteCustomer(Number(req.params['id']), tenantId);
    res.status(204).send();
  });

  getDeletedCustomers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const customers = await this.customerService.getDeletedCustomers(tenantId);
    res.status(200).json({ status: 'success', data: customers });
  });

  restoreCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const customer = await this.customerService.restoreCustomer(Number(req.params['id']), tenantId);
    res.status(200).json({ status: 'success', data: customer });
  });

  hardDeleteCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    await this.customerService.hardDeleteCustomer(Number(req.params['id']), tenantId);
    res.status(204).send();
  });

  searchCustomers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const searchData: SearchCustomerDto = req.query as any;
    const customers = await this.customerService.searchCustomers(searchData, tenantId);
    res.status(200).json({ status: 'success', data: customers });
  });
}
