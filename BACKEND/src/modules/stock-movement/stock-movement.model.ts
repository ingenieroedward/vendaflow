import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript';
import { Product } from '@/modules/product/product.model';
import { User } from '@/modules/user/user.model';
import { Tenant } from '@/modules/tenant/tenant.model';

export type MovementType = 'sale' | 'purchase' | 'adjustment';
export type ReferenceType = 'order' | 'purchase_order' | 'adjustment';

export interface StockMovementAttributes {
  id: number;
  tenantId: number;
  productId: number;
  type: MovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceId: number | null;
  referenceType: ReferenceType | null;
  userId: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovementCreationAttributes
  extends Omit<StockMovementAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

@Table({
  tableName: 'stock_movements',
  timestamps: true,
  paranoid: false,
})
export class StockMovement extends Model<StockMovementAttributes, StockMovementCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.INTEGER, allowNull: false })
  tenantId!: number;

  @BelongsTo(() => Tenant)
  tenant!: Tenant;

  @ForeignKey(() => Product)
  @Column({ type: DataType.INTEGER, allowNull: false })
  productId!: number;

  @BelongsTo(() => Product)
  product!: Product;

  @Column({
    type: DataType.ENUM('sale', 'purchase', 'adjustment'),
    allowNull: false,
  })
  type!: MovementType;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  quantity!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  stockBefore!: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  stockAfter!: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  referenceId!: number | null;

  @Column({
    type: DataType.ENUM('order', 'purchase_order', 'adjustment'),
    allowNull: true,
  })
  referenceType!: ReferenceType | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string | null;

  @CreatedAt
  override createdAt!: Date;

  @UpdatedAt
  override updatedAt!: Date;
}
