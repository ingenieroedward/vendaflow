import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from '@/modules/user/user.model';

export interface PushSubscriptionAttributes {
  id: number;
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface PushSubscriptionCreationAttributes
  extends Omit<PushSubscriptionAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

@Table({
  tableName: 'push_subscriptions',
  timestamps: true,
  paranoid: true,
})
export class PushSubscription extends Model<
  PushSubscriptionAttributes,
  PushSubscriptionCreationAttributes
> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @Column({ type: DataType.TEXT, allowNull: false })
  endpoint!: string;

  @Column({ type: DataType.STRING(512), allowNull: false })
  p256dh!: string;

  @Column({ type: DataType.STRING(128), allowNull: false })
  auth!: string;

  @BelongsTo(() => User)
  user!: User;

  @CreatedAt
  override createdAt!: Date;

  @UpdatedAt
  override updatedAt!: Date;

  @DeletedAt
  override deletedAt?: Date;
}
