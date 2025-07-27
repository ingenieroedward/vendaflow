import { Model } from 'sequelize-typescript';
import { Price } from '../price/price.model';
export interface SupplierAttributes {
    id: number;
    name: string;
    contact: string;
    location: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
export interface SupplierCreationAttributes extends Omit<SupplierAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
}
export declare class Supplier extends Model<SupplierAttributes, SupplierCreationAttributes> {
    id: number;
    name: string;
    contact: string;
    location: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    prices: Price[];
    toJSON(): Partial<SupplierAttributes>;
}
//# sourceMappingURL=supplier.model.d.ts.map