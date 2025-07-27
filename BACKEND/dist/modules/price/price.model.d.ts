import { Model } from 'sequelize-typescript';
import { Product } from '../product/product.model';
import { Supplier } from '../supplier/supplier.model';
import { User } from '../user/user.model';
export interface PriceAttributes {
    id: number;
    productId: number;
    supplierId: number;
    price: number;
    updatedByUserId: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
export interface PriceCreationAttributes extends Omit<PriceAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
}
export declare class Price extends Model<PriceAttributes, PriceCreationAttributes> {
    id: number;
    productId: number;
    supplierId: number;
    price: number;
    updatedByUserId: number;
    product: Product;
    supplier: Supplier;
    updatedByUser: User;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    toJSON(): Partial<PriceAttributes>;
}
//# sourceMappingURL=price.model.d.ts.map