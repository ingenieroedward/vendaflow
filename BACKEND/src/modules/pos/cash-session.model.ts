import { Table, Column, Model, DataType, CreatedAt, UpdatedAt, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { User } from '../user/user.model';

export type CashSessionStatus = 'open' | 'closed';

export interface CashSessionAttributes {
  id: number;
  tenantId: number;
  userId: number; // cajero que abrió el turno
  openedAt: Date;
  closedAt: Date | null;
  openingAmount: number; // base inicial declarada en efectivo
  expectedCash: number | null; // openingAmount + ventas en efectivo del turno (calculado al cerrar)
  countedCash: number | null; // lo que el cajero cuenta físicamente al cerrar
  difference: number | null; // countedCash - expectedCash (faltante negativo, sobrante positivo)
  status: CashSessionStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CashSessionCreationAttributes
  extends Omit<CashSessionAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Turno de caja del POS: un cajero abre con un monto base, vende, y cierra
// contando físicamente el efectivo — la diferencia es el control real de caja.
@Table({ tableName: 'cash_register_sessions', timestamps: true })
export class CashSession extends Model<CashSessionAttributes, CashSessionCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  tenantId!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  openedAt!: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  closedAt!: Date | null;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false, defaultValue: 0 })
  openingAmount!: number;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: true })
  expectedCash!: number | null;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: true })
  countedCash!: number | null;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: true })
  difference!: number | null;

  @Column({ type: DataType.ENUM('open', 'closed'), allowNull: false, defaultValue: 'open' })
  status!: CashSessionStatus;

  @Column({ type: DataType.STRING(255), allowNull: true })
  notes!: string | null;

  @CreatedAt override createdAt!: Date;
  @UpdatedAt override updatedAt!: Date;
}
