import { Request, Response } from 'express';
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { PaginationQuery } from '@/core/utils/validation';

export class CategoryController {
  private categoryService: CategoryService;

  constructor() {
    this.categoryService = new CategoryService();
  }

  createCategory = asyncHandler(async (req: Request, res: Response) => {
    const categoryData: CreateCategoryDto = req.body;
    const category = await this.categoryService.createCategory(categoryData);

    res.status(201).json({
      status: 'success',
      data: category,
    });
  });

  getAllCategories = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as PaginationQuery;
    const result = await this.categoryService.getAllCategories(query);

    res.status(200).json({
      status: 'success',
      data: result.categories,
      pagination: result.pagination,
    });
  });

  getCategoryById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const category = await this.categoryService.getCategoryById(Number(id));

    res.status(200).json({
      status: 'success',
      data: category,
    });
  });

  updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: UpdateCategoryDto = req.body;
    const category = await this.categoryService.updateCategory(Number(id), updateData);

    res.status(200).json({
      status: 'success',
      data: category,
    });
  });

  deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.categoryService.deleteCategory(Number(id));

    res.status(204).send();
  });
} 