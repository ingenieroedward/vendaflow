import { Table, Column, Model, DataType, UpdatedAt, CreatedAt } from 'sequelize-typescript';

export interface PlatformSettingAttributes {
  key: string;
  value: string;
}

// Configuración global de la plataforma editable desde el superadmin
// (llave Bre-B, precios de planes, etc.)
@Table({ tableName: 'platform_settings', timestamps: true })
export class PlatformSetting extends Model<PlatformSettingAttributes> {
  @Column({ type: DataType.STRING(60), primaryKey: true })
  key!: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  value!: string;

  @CreatedAt override createdAt!: Date;
  @UpdatedAt override updatedAt!: Date;
}
