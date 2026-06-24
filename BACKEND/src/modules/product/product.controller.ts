import { Request, Response } from 'express';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto, SearchProductDto } from './product.dto';
import { asyncHandler } from '@/core/middlewares/asyncHandler';

export class ProductController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  createProduct = asyncHandler(async (req: Request, res: Response) => {
    const productData: CreateProductDto = req.body;
    const product = await this.productService.createProduct(productData);

    res.status(201).json({
      status: 'success',
      data: product,
    });
  });

  getAllProducts = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.productService.getAllProducts(req.query as any);
    res.status(200).json({
      status: 'success',
      data: result.products,
      pagination: result.pagination,
    });
  });

  getAllProductsPrices = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.productService.getAllProducts(req.query as any, false);
    res.status(200).json({
      status: 'success',
      data: result.products,
      pagination: result.pagination,
    });
  });


  getProductById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const product = await this.productService.getProductById(Number(id));

    res.status(200).json({
      status: 'success',
      data: product,
    });
  });

  updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: UpdateProductDto = req.body;
    const product = await this.productService.updateProduct(Number(id), updateData);

    res.status(200).json({
      status: 'success',
      data: product,
    });
  });

  deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.productService.deleteProduct(Number(id));

    res.status(204).send();
  });

  searchProducts = asyncHandler(async (req: Request, res: Response) => {
    const searchData: SearchProductDto = req.query as any;
    // required_prices=false: muestra todos los productos, incluyendo los sin precio
    const products = await this.productService.searchProducts(searchData, false);

    res.status(200).json({
      status: 'success',
      data: products,
    });
  });

  searchProductsPrices = asyncHandler(async (req: Request, res: Response) => {
    const searchData: SearchProductDto = req.query as any;
    const products = await this.productService.searchProducts(searchData, true);

    res.status(200).json({
      status: 'success',
      data: products,
    });
  });
  getProductsByCategory = asyncHandler(async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const result = await this.productService.getProductsByCategory(Number(categoryId), req.query as any);

    res.status(200).json({
      status: 'success',
      data: result.products,
      pagination: result.pagination,
    });
  });

  getStockAlerts = asyncHandler(async (_req: Request, res: Response) => {
    const products = await this.productService.getStockAlerts();
    res.status(200).json({ status: 'success', data: products });
  });

  adjustStock = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const product = await this.productService.adjustStock(Number(id), req.body);
    res.status(200).json({ status: 'success', data: product });
  });
} 