import { Table, Column, Model, DataType } from 'sequelize-typescript';

export interface MetricDailyAttributes {
  id: number;
  date: string; // YYYY-MM-DD
  key: string; // landing_view | registro_view | ...
  count: number;
}

// Contadores diarios del embudo público (analytics propio, sin terceros)
@Table({
  tableName: 'metrics_daily',
  timestamps: false,
  indexes: [{ unique: true, fields: ['date', 'key'] }],
})
export class MetricDaily extends Model<MetricDailyAttributes, Omit<MetricDailyAttributes, 'id'>> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  override id!: number;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  date!: string;

  @Column({ type: DataType.STRING(40), allowNull: false })
  key!: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  count!: number;
}
