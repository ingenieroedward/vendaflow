import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  BelongsTo,
  ForeignKey,
  HasMany,
} from 'sequelize-typescript';
import { Category } from '@/modules/category/category.model';
import { Price } from '@/modules/price/price.model';

export interface ProductAttributes {
  id: number;
  name: string;
  code: string;
  unit: string;
  salePrice: number;
  stock: number;
  minStock: number;
  categoryId: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ProductCreationAttributes extends Omit<ProductAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'products',
  timestamps: true,
  paranoid: true, // Soft deletes
})
export class Product extends Model<ProductAttributes, ProductCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  override id!: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255],
    },
  })
  name!: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 50],
    },
  })
  code!: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 50],
    },
  })
  unit!: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
    },
  })
  salePrice!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  stock!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
    },
  })
  minStock!: number;

  @ForeignKey(() => Category)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  categoryId!: number | null;

  @BelongsTo(() => Category)
  category!: Category;

  @CreatedAt
  override createdAt!: Date;

  @UpdatedAt
  override updatedAt!: Date;

  @DeletedAt
  override deletedAt?: Date;

  // Associations
  @HasMany(() => Price)
  prices!: Price[];

  // JSON serialization
  override toJSON(): Partial<ProductAttributes> {
    const values = { ...this.get() };
    return values;
  }
} 