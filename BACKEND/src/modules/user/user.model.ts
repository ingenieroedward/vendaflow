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
} from 'sequelize-typescript';
import bcrypt from 'bcryptjs';
import { Order } from '../order/order.model';
import { Price } from '../price/price.model';

export interface UserAttributes {
  id: number;
  username: string;
  password: string;
  role: 'buyer' | 'seller' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface UserCreationAttributes extends Omit<UserAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'users',
  timestamps: true,
  paranoid: true, // Soft deletes
})
export class User extends Model<UserAttributes, UserCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  override id!: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [3, 255],
    },
  })
  username!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    validate: {
      len: [6, 255],
    },
  })
  password!: string;

  @Column({
    type: DataType.ENUM('buyer', 'seller', 'admin'),
    allowNull: false,
    defaultValue: 'buyer',
  })
  role!: 'buyer' | 'seller' | 'admin';

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