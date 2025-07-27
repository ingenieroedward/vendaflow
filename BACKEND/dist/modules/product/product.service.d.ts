import { CreateProductDto, UpdateProductDto, ProductResponseDto, ProductsListResponseDto, SearchProductDto } from './product.dto';
import { PaginationQuery } from '../../core/utils/validation';
export declare class ProductService {
    createProduct(productData: CreateProductDto): Promise<ProductResponseDto>;
    getAllProducts(query: PaginationQuery, required_prices?: boolean): Promise<ProductsListResponseDto>;
    getProductById(id: number): Promise<ProductResponseDto>;
    updateProduct(id: number, updateData: UpdateProductDto): Promise<ProductResponseDto>;
    deleteProduct(id: number): Promise<void>;
    searchProducts(searchData: SearchProductDto, required_prices?: boolean): Promise<ProductResponseDto[]>;
    getProductsByCategory(categoryId: number, query: PaginationQuery): Promise<ProductsListResponseDto>;
    private mapToResponseDto;
}
//# sourceMappingURL=product.service.d.ts.map