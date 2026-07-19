import { Response } from 'express';
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';
import { PaginationQuery } from '@/core/utils/validation';

export class CategoryController {
  private categoryService: CategoryService;

  constructor() {
    this.categoryService = new CategoryService();
  }

  createCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const categoryData: CreateCategoryDto = req.body;
    const category = await this.categoryService.createCategory(categoryData, tenantId);
    res.status(201).json({ status: 'success', data: category });
  });

  getAllCategories = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const query = req.query as unknown as PaginationQuery;
    const result = await this.categoryService.getAllCategories(query, tenantId);
    res.status(200).json({ status: 'success', data: result.categories, pagination: result.pagination });
  });

  getCategoryById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const category = await this.categoryService.getCategoryById(Number(req.params['id']), tenantId);
    res.status(200).json({ status: 'success', data: category });
  });

  updateCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const updateData: UpdateCategoryDto = req.body;
    const category = await this.categoryService.updateCategory(Number(req.params['id']), updateData, tenantId);
    res.status(200).json({ status: 'success', data: category });
  });

  deleteCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    await this.categoryService.deleteCategory(Number(req.params['id']), tenantId);
    res.status(204).send();
  });
}
