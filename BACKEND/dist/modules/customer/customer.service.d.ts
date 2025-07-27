import { CreateCustomerDto, UpdateCustomerDto, CustomerResponseDto, CustomersListResponseDto, SearchCustomerDto } from './customer.dto';
import { PaginationQuery } from '../../core/utils/validation';
export declare class CustomerService {
    createCustomer(customerData: CreateCustomerDto): Promise<CustomerResponseDto>;
    getAllCustomers(query: PaginationQuery): Promise<CustomersListResponseDto>;
    getCustomerById(id: number): Promise<CustomerResponseDto>;
    updateCustomer(id: number, updateData: UpdateCustomerDto): Promise<CustomerResponseDto>;
    deleteCustomer(id: number): Promise<void>;
    searchCustomers(searchData: SearchCustomerDto): Promise<CustomerResponseDto[]>;
    private mapToResponseDto;
}
//# sourceMappingURL=customer.service.d.ts.map