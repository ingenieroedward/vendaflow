import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  HasMany,
} from 'sequelize-typescript';
import { User } from '../user/user.model';

export type TenantStatus = 'active' | 'trial' | 'suspended' | 'cancelled';
export type TenantPlan = 'trial' | 'basic' | 'pro' | 'enterprise';

export interface TenantAttributes {
  id: number;
  slug: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  logoUrl: string | null;
  primaryColor: string | null;
  trialEndsAt: Date | null;
  maxUsers: number;
  maxProducts: number;
  maxOrdersPerMonth: number;
  customPrice: number | null; // precio especial COP/mes (null = precio de lista del plan)
  paidUntil: string | null; // DATEONLY — pagado hasta (inclusive). null = fuera del ciclo (cortesía/legado)
  suspendedReason: string | null; // trial_expired | nonpayment | manual
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface TenantCreationAttributes extends Omit<TenantAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'tenants',
  timestamps: true,
  paranoid: true,
})
export class Tenant extends Model<TenantAttributes, TenantCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @Column({ type: DataType.STRING(100), allowNull: false, unique: true })
  slug!: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  name!: string;

  @Column({ type: DataType.ENUM('trial', 'basic', 'pro', 'enterprise'), allowNull: false, defaultValue: 'trial' })
  plan!: TenantPlan;

  @Column({ type: DataType.ENUM('active', 'trial', 'suspended', 'cancelled'), allowNull: false, defaultValue: 'trial' })
  status!: TenantStatus;

  @Column({ type: DataType.STRING(500), allowNull: true })
  logoUrl!: string | null;

  @Column({ type: DataType.STRING(7), allowNull: true })
  primaryColor!: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  trialEndsAt!: Date | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 3 })
  maxUsers!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 100 })
  maxProducts!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 50 })
  maxOrdersPerMonth!: number;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: true })
  customPrice!: number | null;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  paidUntil!: string | null;

  @Column({ type: DataType.STRING(20), allowNull: true })
  suspendedReason!: string | null;

  @CreatedAt override createdAt!: Date;
  @UpdatedAt override updatedAt!: Date;
  @DeletedAt override deletedAt?: Date;

  @HasMany(() => User)
  users!: User[];

  get isActive(): boolean {
    return this.status === 'active' || this.status === 'trial';
  }
}
