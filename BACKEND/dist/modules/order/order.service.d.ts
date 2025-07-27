import { CreateOrderDto, UpdateOrderDto, OrderResponseDto, OrdersListResponseDto, SearchOrderDto } from './order.dto';
import { PaginationQuery } from '../../core/utils/validation';
export declare class OrderService {
    private generateOrderNumber;
    createOrder(orderData: CreateOrderDto, userId: number): Promise<OrderResponseDto>;
    getNextOrderNumber(): Promise<{
        nextOrderNumber: string;
    }>;
    getAllOrders(query: PaginationQuery): Promise<OrdersListResponseDto>;
    getOrderById(id: number): Promise<OrderResponseDto>;
    updateOrder(id: number, updateData: UpdateOrderDto): Promise<OrderResponseDto>;
    deleteOrder(id: number): Promise<void>;
    searchOrders(searchData: SearchOrderDto): Promise<OrderResponseDto[]>;
    getOrdersByCustomer(customerId: number, query: PaginationQuery): Promise<OrdersListResponseDto>;
    private mapToResponseDto;
}
//# sourceMappingURL=order.service.d.ts.map