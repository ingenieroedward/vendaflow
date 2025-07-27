import { CreatePriceDto, UpdatePriceDto, PriceResponseDto, PricesListResponseDto } from './price.dto';
import { PaginationQuery } from '../../core/utils/validation';
export declare class PriceService {
    createPrice(priceData: CreatePriceDto, userId: number): Promise<PriceResponseDto>;
    getAllPrices(query: PaginationQuery): Promise<PricesListResponseDto>;
    getPriceById(id: number): Promise<PriceResponseDto>;
    updatePrice(id: number, updateData: UpdatePriceDto, userId: number): Promise<PriceResponseDto>;
    deletePrice(id: number): Promise<void>;
    getPricesByProduct(productId: number): Promise<PriceResponseDto[]>;
    private mapToResponseDto;
}
//# sourceMappingURL=price.service.d.ts.map