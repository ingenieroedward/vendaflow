import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript';
import { Product } from '@/modules/product/product.model';
import { Supplier } from '@/modules/supplier/supplier.model';
import { User } from '@/modules/user/user.model';

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

export interface PriceCreationAttributes extends Omit<PriceAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'prices',
  timestamps: true,
  paranoid: true, // Soft deletes
})
export class Price extends Model<PriceAttributes, PriceCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  override id!: number;

  @ForeignKey(() => Product)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  productId!: number;

  @ForeignKey(() => Supplier)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  supplierId!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0,
    },
  })
  price!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  updatedByUserId!: number;

  @BelongsTo(() => Product)
  product!: Product;

  @BelongsTo(() => Supplier)
  supplier!: Supplier;

  @BelongsTo(() => User)
  updatedByUser!: User;

  @CreatedAt
  override createdAt!: Date;

  @UpdatedAt
  override updatedAt!: Date;

  @DeletedAt
  override deletedAt?: Date;

  // JSON serialization
  override toJSON(): Partial<PriceAttributes> {
    const values = { ...this.get() };
    return values;
  }
} 