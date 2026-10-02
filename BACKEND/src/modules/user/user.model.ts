import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  BeforeCreate,
  BeforeUpdate,
  HasMany,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript';
import bcrypt from 'bcryptjs';
import { Order } from '../order/order.model';
import { Price } from '../price/price.model';
import { Tenant } from '../tenant/tenant.model';

export interface UserAttributes {
  id: number;
  tenantId: number;
  username: string;
  password: string;
  totpSecret?: string | null;
  totpBackupCodes?: string | null;
  name?: string | null;
  role: 'buyer' | 'seller' | 'admin' | 'superadmin';
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface UserCreationAttributes extends Omit<UserAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'users',
  timestamps: true,
  paranoid: true,
  indexes: [{ unique: true, fields: ['tenantId', 'username'] }],
})
export class User extends Model<UserAttributes, UserCreationAttributes> {
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
    type: DataType.STRING(255),
    allowNull: false,
    validate: { notEmpty: true, len: [3, 255] },
  })
  username!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    validate: { len: [6, 255] },
  })
  password!: string;

  // Secreto TOTP (2FA) — solo se exige en login de superadmin si está seteado
  @Column({ type: DataType.STRING(64), allowNull: true })
  totpSecret!: string | null;

  // JSON array de hashes SHA-256 de códigos de respaldo de un solo uso — ver
  // core/totp.ts. Nunca se guarda el texto plano.
  @Column({ type: DataType.TEXT, allowNull: true })
  totpBackupCodes!: string | null;

  // Nombre completo — opcional, distinto del username (que es el login)
  @Column({ type: DataType.STRING(255), allowNull: true })
  name!: string | null;

  @Column({
    type: DataType.ENUM('buyer', 'seller', 'admin', 'superadmin'),
    allowNull: false,
    defaultValue: 'buyer',
  })
  role!: 'buyer' | 'seller' | 'admin' | 'superadmin';

  @CreatedAt
  override createdAt!: Date;

  @UpdatedAt
  override updatedAt!: Date;

  @DeletedAt
  override deletedAt?: Date;

  @HasMany(() => Order)
  orders!: Order[];

  @HasMany(() => Price)
  prices!: Price[];

  // Instance methods
  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }

  // Hooks
  @BeforeCreate
  @BeforeUpdate
  static async hashPassword(instance: User): Promise<void> {
    if (instance.changed('password')) {
      const salt = await bcrypt.genSalt(10);
      instance.password = await bcrypt.hash(instance.password, salt);
    }
  }

  // JSON serialization
  override toJSON(): Partial<UserAttributes> {
    const values = { ...this.get() } as any;
    delete values.password;
    return values;
  }
} 