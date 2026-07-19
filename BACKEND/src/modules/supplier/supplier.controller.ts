import { Response } from 'express';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto, UpdateSupplierDto } from './supplier.dto';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';
import { PaginationQuery } from '@/core/utils/validation';

export class SupplierController {
  private supplierService: SupplierService;

  constructor() {
    this.supplierService = new SupplierService();
  }

  createSupplier = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const supplierData: CreateSupplierDto = req.body;
    const supplier = await this.supplierService.createSupplier(supplierData, tenantId);
    res.status(201).json({ status: 'success', data: supplier });
  });

  getAllSuppliers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const query = req.query as unknown as PaginationQuery;
    const result = await this.supplierService.getAllSuppliers(query, tenantId);
    res.status(200).json({ status: 'success', data: result.suppliers, pagination: result.pagination });
  });

  getSupplierById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const supplier = await this.supplierService.getSupplierById(Number(req.params['id']), tenantId);
    res.status(200).json({ status: 'success', data: supplier });
  });

  updateSupplier = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const updateData: UpdateSupplierDto = req.body;
    const supplier = await this.supplierService.updateSupplier(Number(req.params['id']), updateData, tenantId);
    res.status(200).json({ status: 'success', data: supplier });
  });

  deleteSupplier = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    await this.supplierService.deleteSupplier(Number(req.params['id']), tenantId);
    res.status(204).send();
  });
}
