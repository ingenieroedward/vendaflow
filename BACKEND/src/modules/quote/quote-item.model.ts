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
} from 'sequelize-typescript';
import { Quote } from './quote.model';
import { Product } from '@/modules/product/product.model';

export interface QuoteItemAttributes {
  id: number;
  quoteId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  totalPrice: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface QuoteItemCreationAttributes extends Omit<QuoteItemAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'quote_items',
  timestamps: true,
  paranoid: true, // Soft deletes
})
export class QuoteItem extends Model<QuoteItemAttributes, QuoteItemCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  override id!: number;

  @ForeignKey(() => Quote)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  quoteId!: number;

  @ForeignKey(() => Product)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  productId!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
    },
  })
  quantity!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0,
    },
  })
  unitPrice!: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    validate: {
      min: 0,
      max: 100,
    },
  })
  taxRate!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0,
    },
  })
  totalPrice!: number;

  @BelongsTo(() => Quote)
  quote!: Quote;

  @BelongsTo(() => Product)
  product!: Product;

  @CreatedAt
  override createdAt!: Date;

  @UpdatedAt
  override updatedAt!: Date;

  @DeletedAt
  override deletedAt?: Date;

  // JSON serialization
  override toJSON(): Partial<QuoteItemAttributes> {
    const values = { ...this.get() };
    return values;
  }
}
