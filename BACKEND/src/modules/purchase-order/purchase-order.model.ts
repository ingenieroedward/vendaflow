import {
  Table, Column, Model, DataType,
  CreatedAt, UpdatedAt, DeletedAt,
  BelongsTo, ForeignKey, HasMany,
} from 'sequelize-typescript';
import { Supplier } from '@/modules/supplier/supplier.model';
import { User } from '@/modules/user/user.model';
import { Tenant } from '@/modules/tenant/tenant.model';
import { PurchaseOrderItem } from './purchase-order-item/purchase-order-item.model';

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseOrderAttributes {
  id: number;
  tenantId: number;
  poNumber: string;
  supplierId: number;
  userId: number;
  totalAmount: number;
  status: PurchaseOrderStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface PurchaseOrderCreationAttributes
  extends Omit<PurchaseOrderAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'purchase_orders',
  timestamps: true,
  paranoid: true,
  indexes: [{ unique: true, fields: ['tenantId', 'poNumber'] }],
})
export class PurchaseOrder extends Model<PurchaseOrderAttributes, PurchaseOrderCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.INTEGER, allowNull: false })
  tenantId!: number;

  @BelongsTo(() => Tenant)
  tenant!: Tenant;

  @Column({ type: DataType.STRING(50), allowNull: false })
  poNumber!: string;

  @ForeignKey(() => Supplier)
  @Column({ type: DataType.INTEGER, allowNull: false })
  supplierId!: number;

  @BelongsTo(() => Supplier)
  supplier!: Supplier;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0 })
  totalAmount!: number;

  @Column({
    type: DataType.ENUM('draft', 'ordered', 'received', 'cancelled'),
    allowNull: false,
    defaultValue: 'draft',
  })
  status!: PurchaseOrderStatus;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string | null;

  @HasMany(() => PurchaseOrderItem)
  items!: PurchaseOrderItem[];

  @CreatedAt override createdAt!: Date;
  @UpdatedAt override updatedAt!: Date;
  @DeletedAt override deletedAt?: Date;
}
