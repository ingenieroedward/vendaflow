import { Model } from 'sequelize-typescript';
import { Order } from '../order/order.model';
import { Price } from '../price/price.model';
export interface UserAttributes {
    id: number;
    username: string;
    password: string;
    role: 'buyer' | 'seller' | 'admin';
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
export interface UserCreationAttributes extends Omit<UserAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
}
export declare class User extends Model<UserAttributes, UserCreationAttributes> {
    id: number;
    username: string;
    password: string;
    role: 'buyer' | 'seller' | 'admin';
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    orders: Order[];
    prices: Price[];
    comparePassword(candidatePassword: string): Promise<boolean>;
    static hashPassword(instance: User): Promise<void>;
    toJSON(): Partial<UserAttributes>;
}
//# sourceMappingURL=user.model.d.ts.map