import { Model } from "sequelize-typescript";
export interface CustomerAttributes {
    id: number;
    name: string;
    contact: string;
    address: string;
    note: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
export interface CustomerCreationAttributes extends Omit<CustomerAttributes, "id" | "createdAt" | "updatedAt" | "deletedAt"> {
}
export declare class Customer extends Model<CustomerAttributes, CustomerCreationAttributes> {
    id: number;
    name: string;
    contact: string;
    address: string;
    note: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    toJSON(): Partial<CustomerAttributes>;
}
//# sourceMappingURL=customer.model.d.ts.map