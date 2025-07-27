import { CreateSupplierDto, UpdateSupplierDto, SupplierResponseDto, SuppliersListResponseDto } from './supplier.dto';
import { PaginationQuery } from '../../core/utils/validation';
export declare class SupplierService {
    createSupplier(supplierData: CreateSupplierDto): Promise<SupplierResponseDto>;
    getAllSuppliers(query: PaginationQuery): Promise<SuppliersListResponseDto>;
    getSupplierById(id: number): Promise<SupplierResponseDto>;
    updateSupplier(id: number, updateData: UpdateSupplierDto): Promise<SupplierResponseDto>;
    deleteSupplier(id: number): Promise<void>;
    private mapToResponseDto;
}
//# sourceMappingURL=supplier.service.d.ts.map