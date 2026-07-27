import { Table, Column, Model, DataType, CreatedAt } from 'sequelize-typescript';

export interface OrderPaymentAttributes {
  id: number;
  tenantId: number;
  orderId: number;
  amount: number;
  notes: string | null;
  userId: number | null;
  createdAt: Date;
}

export interface OrderPaymentCreationAttributes extends Omit<OrderPaymentAttributes, 'id' | 'createdAt'> {}

// Abonos parciales a órdenes a crédito
@Table({ tableName: 'order_payments', timestamps: true, updatedAt: false })
export class OrderPayment extends Model<OrderPaymentAttributes, OrderPaymentCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  tenantId!: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  orderId!: number;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  amount!: number;

  @Column({ type: DataType.STRING(255), allowNull: true })
  notes!: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  userId!: number | null;

  @CreatedAt override createdAt!: Date;
}
