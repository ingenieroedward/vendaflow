import { Response } from 'express';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto, SearchProductDto } from './product.dto';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';

export class ProductController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  createProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const productData: CreateProductDto = req.body;
    const product = await this.productService.createProduct(productData, tenantId);
    res.status(201).json({ status: 'success', data: product });
  });

  getAllProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const result = await this.productService.getAllProducts(req.query as any, tenantId, false);
    res.status(200).json({ status: 'success', data: result.products, pagination: result.pagination });
  });

  getAllProductsPrices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const result = await this.productService.getAllProducts(req.query as any, tenantId, false);
    res.status(200).json({ status: 'success', data: result.products, pagination: result.pagination });
  });

  getProductById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const product = await this.productService.getProductById(Number(req.params['id']), tenantId);
    res.status(200).json({ status: 'success', data: product });
  });

  updateProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const updateData: UpdateProductDto = req.body;
    const product = await this.productService.updateProduct(Number(req.params['id']), updateData, tenantId, req.user!.id);
    res.status(200).json({ status: 'success', data: product });
  });

  deleteProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    await this.productService.deleteProduct(Number(req.params['id']), tenantId);
    res.status(204).send();
  });

  searchProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const searchData: SearchProductDto = req.query as any;
    const products = await this.productService.searchProducts(searchData, tenantId, false);
    res.status(200).json({ status: 'success', data: products });
  });

  searchProductsPrices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const searchData: SearchProductDto = req.query as any;
    const products = await this.productService.searchProducts(searchData, tenantId, true);
    res.status(200).json({ status: 'success', data: products });
  });

  getProductsByCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const result = await this.productService.getProductsByCategory(Number(req.params['categoryId']), req.query as any, tenantId);
    res.status(200).json({ status: 'success', data: result.products, pagination: result.pagination });
  });

  getNextCode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await this.productService.getNextCode(req.user!.tenantId);
    res.status(200).json({ status: 'success', data: result });
  });

  getStockAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const products = await this.productService.getStockAlerts(tenantId);
    res.status(200).json({ status: 'success', data: products });
  });

  adjustStock = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const product = await this.productService.adjustStock(Number(req.params['id']), req.body, tenantId, req.user!.id);
    res.status(200).json({ status: 'success', data: product });
  });
}
