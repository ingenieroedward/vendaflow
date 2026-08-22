import { Table, Column, Model, DataType, CreatedAt, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Order } from '../order/order.model';

export type PosPaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

export interface PosSalePaymentAttributes {
  id: number;
  tenantId: number;
  orderId: number;
  cashSessionId: number; // duplicado desde la orden — evita un join para sumar por turno al cerrar caja
  method: PosPaymentMethod;
  amount: number;
  createdAt: Date;
}

export interface PosSalePaymentCreationAttributes extends Omit<PosSalePaymentAttributes, 'id' | 'createdAt'> {}

// Desglose de pago de una venta POS (pago mixto: parte efectivo, parte
// tarjeta, etc.) — separado de order_payments (que son abonos a crédito,
// otro concepto) para no arriesgar la lógica de cartera ya existente.
@Table({ tableName: 'pos_sale_payments', timestamps: true, updatedAt: false })
export class PosSalePayment extends Model<PosSalePaymentAttributes, PosSalePaymentCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  tenantId!: number;

  @ForeignKey(() => Order)
  @Column({ type: DataType.INTEGER, allowNull: false })
  orderId!: number;

  @BelongsTo(() => Order)
  order!: Order;

  @Column({ type: DataType.INTEGER, allowNull: false })
  cashSessionId!: number;

  @Column({ type: DataType.ENUM('cash', 'card', 'transfer', 'other'), allowNull: false })
  method!: PosPaymentMethod;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  amount!: number;

  @CreatedAt override createdAt!: Date;
}
