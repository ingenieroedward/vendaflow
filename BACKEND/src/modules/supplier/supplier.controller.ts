import { Request, Response } from 'express';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto, UpdateSupplierDto } from './supplier.dto';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { PaginationQuery } from '@/core/utils/validation';

export class SupplierController {
  private supplierService: SupplierService;

  constructor() {
    this.supplierService = new SupplierService();
  }

  createSupplier = asyncHandler(async (req: Request, res: Response) => {
    const supplierData: CreateSupplierDto = req.body;
    const supplier = await this.supplierService.createSupplier(supplierData);

    res.status(201).json({
      status: 'success',
      data: supplier,
    });
  });

  getAllSuppliers = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as PaginationQuery;
    const result = await this.supplierService.getAllSuppliers(query);

    res.status(200).json({
      status: 'success',
      data: result.suppliers,
      pagination: result.pagination,
    });
  });

  getSupplierById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const supplier = await this.supplierService.getSupplierById(Number(id));

    res.status(200).json({
      status: 'success',
      data: supplier,
    });
  });

  updateSupplier = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: UpdateSupplierDto = req.body;
    const supplier = await this.supplierService.updateSupplier(Number(id), updateData);

    res.status(200).json({
      status: 'success',
      data: supplier,
    });
  });

  deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.supplierService.deleteSupplier(Number(id));

    res.status(204).send();
  });
} 