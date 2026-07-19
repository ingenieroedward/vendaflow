import {
  Column,
  CreatedAt,
  DataType,
  DeletedAt,
  Model,
  Table,
  UpdatedAt,
  BelongsTo,
  ForeignKey,
} from "sequelize-typescript";
import { Tenant } from "@/modules/tenant/tenant.model";

export interface CustomerAttributes {
  id: number;
  tenantId: number;
  code: string | null;
  name: string;
  nit: string | null;
  contact: string;
  address: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CustomerCreationAttributes
  extends Omit<
    CustomerAttributes,
    "id" | "createdAt" | "updatedAt" | "deletedAt"
  > {}

@Table({
  tableName: "customers",
  timestamps: true,
  paranoid: true,
  indexes: [
    { unique: true, fields: ['tenantId', 'code'] },
    { unique: true, fields: ['tenantId', 'nit'] },
  ],
})
export class Customer extends Model<CustomerAttributes, CustomerCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.INTEGER, allowNull: false })
  tenantId!: number;

  @BelongsTo(() => Tenant)
  tenant!: Tenant;

  @Column({ type: DataType.STRING(50), allowNull: true })
  code!: string | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    validate: { notEmpty: true, len: [1, 255] },
  })
  name!: string;

  @Column({ type: DataType.STRING(20), allowNull: true })
  nit!: string | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255],
    },
  })
  contact!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255],
    },
  })
  address!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255],
    },
  })
  note!: string;

  @CreatedAt
  override createdAt!: Date;

  @UpdatedAt
  override updatedAt!: Date;

  @DeletedAt
  override deletedAt?: Date;

  // Associations

  // JSON serialization
  override toJSON(): Partial<CustomerAttributes> {
    const values = { ...this.get() };
    return values;
  }
}
