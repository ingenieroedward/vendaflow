import { Model } from 'sequelize-typescript';
import { Product } from '../product/product.model';
export interface CategoryAttributes {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
export interface CategoryCreationAttributes extends Omit<CategoryAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
}
export declare class Category extends Model<CategoryAttributes, CategoryCreationAttributes> {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    products: Product[];
    toJSON(): Partial<CategoryAttributes>;
}
//# sourceMappingURL=category.model.d.ts.map