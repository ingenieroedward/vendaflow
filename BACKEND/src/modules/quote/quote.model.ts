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
import { Order } from '@/modules/order/order.model';
import { Tenant } from '@/modules/tenant/tenant.model';
import { QuoteItem } from './quote-item.model';

export interface QuoteAttributes {
  id: number;
  tenantId: number;
  quoteNumber: string;
  clientRef?: string | null; // idempotencia offline-first, mismo patrón que orders.clientRef
  customerId: number;
  userId: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
  notes: string | null;
  validUntil: Date | null;
  convertedOrderId: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface QuoteCreationAttributes extends Omit<QuoteAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'quotes',
  timestamps: true,
  paranoid: true, // Soft deletes
  indexes: [{ unique: true, fields: ['tenantId', 'quoteNumber'] }],
})
export class Quote extends Model<QuoteAttributes, QuoteCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  override id!: number;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.INTEGER, allowNull: false })
  tenantId!: number;

  @BelongsTo(() => Tenant)
  tenant!: Tenant;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 50],
    },
  })
  quoteNumber!: string;

  // Clave de idempotencia enviada por el cliente offline-first: dos POST con
  // el mismo ref devuelven la misma cotización (evita duplicados al reintentar sync)
  @Column({ type: DataType.STRING(64), allowNull: true })
  clientRef!: string | null;

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
    type: DataType.ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'),
    allowNull: false,
    defaultValue: 'draft',
  })
  status!: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  notes!: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  validUntil!: Date | null;

  @ForeignKey(() => Order)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  convertedOrderId!: number | null;

  @BelongsTo(() => Customer)
  customer!: Customer;

  @BelongsTo(() => User)
  user!: User;

  @BelongsTo(() => Order)
  convertedOrder!: Order;

  @HasMany(() => QuoteItem)
  quoteItems!: QuoteItem[];

  @CreatedAt
  override createdAt!: Date;

  @UpdatedAt
  override updatedAt!: Date;

  @DeletedAt
  override deletedAt?: Date;

  // JSON serialization
  override toJSON(): Partial<QuoteAttributes> {
    const values = { ...this.get() };
    return values;
  }
}
