import {
  Table, Column, Model, DataType,
  CreatedAt, UpdatedAt, DeletedAt,
  BelongsTo, ForeignKey,
} from 'sequelize-typescript';
import { Product } from '@/modules/product/product.model';

export interface PurchaseOrderItemAttributes {
  id: number;
  purchaseOrderId: number;
  productId: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface PurchaseOrderItemCreationAttributes
  extends Omit<PurchaseOrderItemAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({ tableName: 'purchase_order_items', timestamps: true, paranoid: true })
export class PurchaseOrderItem extends Model<PurchaseOrderItemAttributes, PurchaseOrderItemCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  purchaseOrderId!: number;

  @ForeignKey(() => Product)
  @Column({ type: DataType.INTEGER, allowNull: false })
  productId!: number;

  @BelongsTo(() => Product)
  product!: Product;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, validate: { min: 0.01 } })
  quantity!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0, validate: { min: 0 } })
  unitCost!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0, validate: { min: 0 } })
  totalCost!: number;

  @CreatedAt override createdAt!: Date;
  @UpdatedAt override updatedAt!: Date;
  @DeletedAt override deletedAt?: Date;
}
