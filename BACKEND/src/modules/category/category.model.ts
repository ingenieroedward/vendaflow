import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  HasMany,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript';
import { Product } from '@/modules/product/product.model';
import { Tenant } from '@/modules/tenant/tenant.model';

export interface CategoryAttributes {
  id: number;
  tenantId: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CategoryCreationAttributes extends Omit<CategoryAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'categories',
  timestamps: true,
  paranoid: true,
})
export class Category extends Model<CategoryAttributes, CategoryCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.INTEGER, allowNull: false })
  tenantId!: number;

  @BelongsTo(() => Tenant)
  tenant!: Tenant;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255],
    },
  })
  name!: string;

  @CreatedAt
  override createdAt!: Date;

  @UpdatedAt
  override updatedAt!: Date;

  @DeletedAt
  override deletedAt?: Date;

  // Associations
  @HasMany(() => Product)
  products!: Product[];

  // JSON serialization
  override toJSON(): Partial<CategoryAttributes> {
    const values = { ...this.get() };
    return values;
  }
} 