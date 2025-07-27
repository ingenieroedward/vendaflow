import { Model } from 'sequelize-typescript';
import { Category } from '../category/category.model';
import { Price } from '../price/price.model';
export interface ProductAttributes {
    id: number;
    name: string;
    code: string;
    unit: string;
    salePrice: number;
    categoryId: number | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
export interface ProductCreationAttributes extends Omit<ProductAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
}
export declare class Product extends Model<ProductAttributes, ProductCreationAttributes> {
    id: number;
    name: string;
    code: string;
    unit: string;
    salePrice: number;
    categoryId: number | null;
    category: Category;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    prices: Price[];
    toJSON(): Partial<ProductAttributes>;
}
//# sourceMappingURL=product.model.d.ts.map