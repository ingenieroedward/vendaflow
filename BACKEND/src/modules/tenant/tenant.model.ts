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
import { config } from '@/config';

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

  @CreatedAt override createdAt!: Date;
  @UpdatedAt override updatedAt!: Date;
  @DeletedAt override deletedAt?: Date;

  @HasMany(() => User)
  users!: User[];

  get isTrialExpired(): boolean {
    return this.status === 'trial' && !!this.trialEndsAt && this.trialEndsAt.getTime() < Date.now();
  }

  get isActive(): boolean {
    if (this.status === 'active') return true;
    if (this.status !== 'trial') return false;
    // Solo bloquea pruebas vencidas si ENFORCE_TRIAL_EXPIRY=true
    return !(config.saas.enforceTrialExpiry && this.isTrialExpired);
  }
}
