import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  HasMany,
} from 'sequelize-typescript';
import { Price } from '@/modules/price/price.model';

export interface SupplierAttributes {
  id: number;
  name: string;
  contact: string;
  location: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface SupplierCreationAttributes extends Omit<SupplierAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'suppliers',
  timestamps: true,
  paranoid: true, // Soft deletes
})
export class Supplier extends Model<SupplierAttributes, SupplierCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  override id!: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255],
    },
  })
  name!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255],
    },
  })
  contact!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255],
    },
  })
  location!: string;

  @CreatedAt
  override createdAt!: Date;

  @UpdatedAt
  override updatedAt!: Date;

  @DeletedAt
  override deletedAt?: Date;

  // Associations
  @HasMany(() => Price)
  prices!: Price[];

  // JSON serialization
  override toJSON(): Partial<SupplierAttributes> {
    const values = { ...this.get() };
    return values;
  }
} 