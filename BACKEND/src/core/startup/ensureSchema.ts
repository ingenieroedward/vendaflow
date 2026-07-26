import sequelize from '@/database';
import { DataType } from 'sequelize-typescript';
import logger from '@/core/logger';

/**
 * Migración mínima al arranque: agrega columnas nuevas a tablas existentes.
 * sequelize.sync({ alter: false }) solo crea tablas nuevas, nunca columnas —
 * sin esto, cada columna nueva requeriría un ALTER TABLE manual en producción.
 */
export async function ensureSchema(): Promise<void> {
  const qi = sequelize.getQueryInterface();

  const orderColumns = await qi.describeTable('orders');

  const missing: Array<{ name: string; spec: object }> = [
    { name: 'paymentType', spec: { type: DataType.ENUM('cash', 'credit'), allowNull: false, defaultValue: 'cash' } },
    { name: 'paymentDueDate', spec: { type: DataType.DATEONLY, allowNull: true } },
    { name: 'reminderDays', spec: { type: DataType.INTEGER, allowNull: true } },
    { name: 'paidAt', spec: { type: DataType.DATE, allowNull: true } },
  ].filter(c => !(c.name in orderColumns));

  for (const col of missing) {
    await qi.addColumn('orders', col.name, col.spec as never);
    logger.info(`[ensureSchema] Column orders.${col.name} added`);
  }

  if (missing.length === 0) {
    logger.info('[ensureSchema] Schema up to date');
  }
}
