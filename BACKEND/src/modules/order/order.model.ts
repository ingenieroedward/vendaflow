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
  HasMany,
} from 'sequelize-typescript';
import { Customer } from '@/modules/customer/customer.model';
import { User } from '@/modules/user/user.model';
import { OrderItem } from './order-item.model';
import { Tenant } from '@/modules/tenant/tenant.model';

export interface OrderAttributes {
  id: number;
  tenantId: number;
  orderNumber: string;
  customerId: number;
  userId: number;
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface OrderCreationAttributes extends Omit<OrderAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'orders',
  timestamps: true,
  paranoid: true,
  indexes: [{ unique: true, fields: ['tenantId', 'orderNumber'] }],
})
export class Order extends Model<OrderAttributes, OrderCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.INTEGER, allowNull: false })
  tenantId!: number;

  @BelongsTo(() => Tenant)
  tenant!: Tenant;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    validate: { notEmpty: true, len: [1, 50] },
  })
  orderNumber!: string;

  @ForeignKey(() => Customer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  customerId!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  userId!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
    },
  })
  totalAmount!: number;

  @Column({
    type: DataType.ENUM('pending', 'processing', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  })
  status!: 'pending' | 'processing' | 'completed' | 'cancelled';

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  notes!: string | null;

  @BelongsTo(() => Customer)
  customer!: Customer;

  @BelongsTo(() => User)
  user!: User;

  @HasMany(() => OrderItem)
  orderItems!: OrderItem[];

  @CreatedAt
  override createdAt!: Date;

  @UpdatedAt
  override updatedAt!: Date;

  @DeletedAt
  override deletedAt?: Date;

  // JSON serialization
  override toJSON(): Partial<OrderAttributes> {
    const values = { ...this.get() };
    return values;
  }
} 