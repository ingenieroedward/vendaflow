import { Model } from 'sequelize-typescript';
import { Order } from './order.model';
import { Product } from '../product/product.model';
export interface OrderItemAttributes {
    id: number;
    orderId: number;
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    totalPrice: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
export interface OrderItemCreationAttributes extends Omit<OrderItemAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
}
export declare class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes> {
    id: number;
    orderId: number;
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    totalPrice: number;
    order: Order;
    product: Product;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    toJSON(): Partial<OrderItemAttributes>;
}
//# sourceMappingURL=order-item.model.d.ts.map