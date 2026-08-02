import { Table, Column, Model, DataType, CreatedAt, UpdatedAt } from 'sequelize-typescript';

export type PlanPaymentStatus = 'pending' | 'approved' | 'rejected';

export interface PlanPaymentAttributes {
  id: number;
  tenantId: number;
  plan: string; // plan que paga: basic | pro | enterprise
  amount: number;
  reference: string | null; // referencia/llave de la transferencia Bre-B
  receiptBase64: string | null; // comprobante (imagen) en base64
  receiptMime: string | null;
  status: PlanPaymentStatus;
  receiptNumber: string | null; // REC-0001, asignado al aprobar
  rejectReason: string | null;
  decidedAt: Date | null;
  source: 'tenant' | 'superadmin'; // quién originó el registro
  method: string | null; // breb | transferencia | efectivo | otro
  months: number; // meses cubiertos por este pago
  paidAt: string | null; // DATEONLY — fecha real del pago
  periodStart: string | null; // DATEONLY — cobertura
  periodEnd: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanPaymentCreationAttributes
  extends Omit<PlanPaymentAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Pagos de suscripción reportados por los tenants (Bre-B manual) — superadmin aprueba
@Table({ tableName: 'plan_payments', timestamps: true })
export class PlanPayment extends Model<PlanPaymentAttributes, PlanPaymentCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  tenantId!: number;

  @Column({ type: DataType.STRING(20), allowNull: false })
  plan!: string;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  amount!: number;

  @Column({ type: DataType.STRING(120), allowNull: true })
  reference!: string | null;

  @Column({ type: DataType.TEXT('medium'), allowNull: true })
  receiptBase64!: string | null;

  @Column({ type: DataType.STRING(60), allowNull: true })
  receiptMime!: string | null;

  @Column({ type: DataType.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' })
  status!: PlanPaymentStatus;

  @Column({ type: DataType.ENUM('tenant', 'superadmin'), allowNull: false, defaultValue: 'tenant' })
  source!: 'tenant' | 'superadmin';

  @Column({ type: DataType.STRING(20), allowNull: true })
  method!: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
  months!: number;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  paidAt!: string | null;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  periodStart!: string | null;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  periodEnd!: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  notes!: string | null;

  @Column({ type: DataType.STRING(20), allowNull: true })
  receiptNumber!: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  rejectReason!: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  decidedAt!: Date | null;

  @CreatedAt override createdAt!: Date;
  @UpdatedAt override updatedAt!: Date;
}
