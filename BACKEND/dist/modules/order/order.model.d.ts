import { Model } from 'sequelize-typescript';
import { Customer } from '../customer/customer.model';
import { User } from '../user/user.model';
import { OrderItem } from './order-item.model';
export interface OrderAttributes {
    id: number;
    orderNumber: string;
    customerId: number;
    userId: number;
    totalAmount: number;
    status: 'pending' | 'processing' | 'completed' | 'cancelled';
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
export interface OrderCreationAttributes extends Omit<OrderAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
}
export declare class Order extends Model<OrderAttributes, OrderCreationAttributes> {
    id: number;
    orderNumber: string;
    customerId: number;
    userId: number;
    totalAmount: number;
    status: 'pending' | 'processing' | 'completed' | 'cancelled';
    notes: string | null;
    customer: Customer;
    user: User;
    orderItems: OrderItem[];
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    toJSON(): Partial<OrderAttributes>;
}
//# sourceMappingURL=order.model.d.ts.map