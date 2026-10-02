import { Table, Column, Model, DataType, CreatedAt } from 'sequelize-typescript';

export interface PlatformAuditLogAttributes {
  id: number;
  userId: number; // superadmin que ejecutó la acción
  username: string;
  action: string; // impersonate | payment_register | payment_approve | ...
  tenantId: number | null;
  tenantSlug: string | null;
  meta: string | null; // JSON con detalle (monto, plan, motivo, …)
  ip: string | null;
  createdAt: Date;
}

export interface PlatformAuditLogCreationAttributes
  extends Omit<PlatformAuditLogAttributes, 'id' | 'createdAt'> {}

// Rastro de las acciones sensibles del superadmin (impersonar, pagos, suspensiones…)
@Table({ tableName: 'platform_audit_logs', timestamps: true, updatedAt: false })
export class PlatformAuditLog extends Model<PlatformAuditLogAttributes, PlatformAuditLogCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @Column({ type: DataType.STRING(100), allowNull: false })
  username!: string;

  @Column({ type: DataType.STRING(40), allowNull: false })
  action!: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  tenantId!: number | null;

  @Column({ type: DataType.STRING(50), allowNull: true })
  tenantSlug!: string | null;

  @Column({ type: DataType.STRING(500), allowNull: true })
  meta!: string | null;

  @Column({ type: DataType.STRING(45), allowNull: true })
  ip!: string | null;

  @CreatedAt override createdAt!: Date;
}

/** Registro tolerante a fallos — nunca rompe la acción que audita */
export async function logAudit(data: {
  userId: number;
  username: string;
  action: string;
  tenantId?: number | null;
  tenantSlug?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  try {
    await PlatformAuditLog.create({
      userId: data.userId,
      username: data.username,
      action: data.action,
      tenantId: data.tenantId ?? null,
      tenantSlug: data.tenantSlug ?? null,
      meta: data.meta ? JSON.stringify(data.meta).slice(0, 500) : null,
      ip: data.ip ?? null,
    });
  } catch {
    // auditoría best-effort
  }
}
