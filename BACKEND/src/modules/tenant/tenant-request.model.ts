import { Table, Column, Model, DataType, CreatedAt, UpdatedAt } from 'sequelize-typescript';

export type TenantRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TenantRequestAttributes {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: TenantRequestStatus;
  tenantId: number | null; // tenant creado al aprobar
  source: string | null; // origen normalizado (ver attribution.ts); null = antes del seguimiento
  campaign: string | null; // utm_campaign saneado
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantRequestCreationAttributes
  extends Omit<TenantRequestAttributes, 'id' | 'source' | 'campaign' | 'createdAt' | 'updatedAt'> {
  source?: string | null;
  campaign?: string | null;
}

// Solicitudes de registro público — el superadmin las aprueba o rechaza
@Table({ tableName: 'tenant_requests', timestamps: true })
export class TenantRequest extends Model<TenantRequestAttributes, TenantRequestCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @Column({ type: DataType.STRING(255), allowNull: false })
  companyName!: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  contactName!: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  email!: string;

  @Column({ type: DataType.STRING(50), allowNull: true })
  phone!: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  message!: string | null;

  @Column({ type: DataType.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' })
  status!: TenantRequestStatus;

  @Column({ type: DataType.INTEGER, allowNull: true })
  tenantId!: number | null;

  @Column({ type: DataType.STRING(20), allowNull: true })
  source!: string | null;

  @Column({ type: DataType.STRING(50), allowNull: true })
  campaign!: string | null;

  @CreatedAt override createdAt!: Date;
  @UpdatedAt override updatedAt!: Date;
}
