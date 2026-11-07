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
    { name: 'clientRef', spec: { type: DataType.STRING(64), allowNull: true } },
    { name: 'source', spec: { type: DataType.ENUM('orders', 'pos'), allowNull: false, defaultValue: 'orders' } },
    { name: 'cashSessionId', spec: { type: DataType.INTEGER, allowNull: true } },
    { name: 'changeGiven', spec: { type: DataType.DECIMAL(12, 2), allowNull: true } },
  ].filter(c => !(c.name in orderColumns));

  for (const col of missing) {
    await qi.addColumn('orders', col.name, col.spec as never);
    logger.info(`[ensureSchema] Column orders.${col.name} added`);
  }

  const tenantCols = await qi.describeTable('tenants');
  if (!('customPrice' in tenantCols)) {
    await qi.addColumn('tenants', 'customPrice', { type: DataType.DECIMAL(12, 2), allowNull: true } as never);
    logger.info('[ensureSchema] Column tenants.customPrice added');
  }
  if (!('paidUntil' in tenantCols)) {
    await qi.addColumn('tenants', 'paidUntil', { type: DataType.DATEONLY, allowNull: true } as never);
    logger.info('[ensureSchema] Column tenants.paidUntil added');
  }
  if (!('suspendedReason' in tenantCols)) {
    await qi.addColumn('tenants', 'suspendedReason', { type: DataType.STRING(20), allowNull: true } as never);
    logger.info('[ensureSchema] Column tenants.suspendedReason added');
  }
  if (!('cancelledAt' in tenantCols)) {
    await qi.addColumn('tenants', 'cancelledAt', { type: DataType.DATE, allowNull: true } as never);
    logger.info('[ensureSchema] Column tenants.cancelledAt added');
  }
  if (!('customFeatures' in tenantCols)) {
    await qi.addColumn('tenants', 'customFeatures', { type: DataType.STRING(500), allowNull: true } as never);
    logger.info('[ensureSchema] Column tenants.customFeatures added');
  }
  const userCols = await qi.describeTable('users');
  if (!('totpSecret' in userCols)) {
    await qi.addColumn('users', 'totpSecret', { type: DataType.STRING(64), allowNull: true } as never);
    logger.info('[ensureSchema] Column users.totpSecret added');
  }
  if (!('totpBackupCodes' in userCols)) {
    // JSON array de hashes SHA-256 (nunca texto plano) — ver core/totp.ts
    await qi.addColumn('users', 'totpBackupCodes', { type: DataType.TEXT, allowNull: true } as never);
    logger.info('[ensureSchema] Column users.totpBackupCodes added');
  }
  if (!('name' in userCols)) {
    await qi.addColumn('users', 'name', { type: DataType.STRING(255), allowNull: true } as never);
    logger.info('[ensureSchema] Column users.name added');
  }
  if (!('tokenVersion' in userCols)) {
    // Revocación de sesiones (v1.16.9): tokens sin `tv` cuentan como 0 → nadie
    // pierde la sesión al desplegar
    await qi.addColumn('users', 'tokenVersion', { type: DataType.INTEGER, allowNull: false, defaultValue: 0 } as never);
    logger.info('[ensureSchema] Column users.tokenVersion added');
  }
  for (const [name, spec] of [
    ['contactName', { type: DataType.STRING(120), allowNull: true }],
    ['contactEmail', { type: DataType.STRING(255), allowNull: true }],
    ['contactPhone', { type: DataType.STRING(30), allowNull: true }],
    // Datos fiscales del negocio del tenant, para sus propios PDF (carta/ticket)
    ['nit', { type: DataType.STRING(30), allowNull: true }],
    ['address', { type: DataType.STRING(255), allowNull: true }],
    ['city', { type: DataType.STRING(120), allowNull: true }],
  ] as const) {
    if (!(name in tenantCols)) {
      await qi.addColumn('tenants', name, spec as never);
      logger.info(`[ensureSchema] Column tenants.${name} added`);
    }
  }

  // plan_payments: campos del ciclo de suscripción (v1.11)
  try {
    const ppCols = await qi.describeTable('plan_payments');
    const ppMissing: Array<{ name: string; spec: object }> = [
      { name: 'source', spec: { type: DataType.ENUM('tenant', 'superadmin'), allowNull: false, defaultValue: 'tenant' } },
      { name: 'method', spec: { type: DataType.STRING(20), allowNull: true } },
      { name: 'months', spec: { type: DataType.INTEGER, allowNull: false, defaultValue: 1 } },
      { name: 'paidAt', spec: { type: DataType.DATEONLY, allowNull: true } },
      { name: 'periodStart', spec: { type: DataType.DATEONLY, allowNull: true } },
      { name: 'periodEnd', spec: { type: DataType.DATEONLY, allowNull: true } },
      { name: 'notes', spec: { type: DataType.STRING(255), allowNull: true } },
    ].filter(c => !(c.name in ppCols));
    for (const col of ppMissing) {
      await qi.addColumn('plan_payments', col.name, col.spec as never);
      logger.info(`[ensureSchema] Column plan_payments.${col.name} added`);
    }
  } catch {
    // la tabla aún no existe — sync la crea completa
  }

  // tenant_requests: atribución del embudo (de dónde llegó la solicitud)
  try {
    const trCols = await qi.describeTable('tenant_requests');
    const trMissing: Array<{ name: string; spec: object }> = [
      { name: 'source', spec: { type: DataType.STRING(20), allowNull: true } },
      { name: 'campaign', spec: { type: DataType.STRING(50), allowNull: true } },
    ].filter(c => !(c.name in trCols));
    for (const col of trMissing) {
      await qi.addColumn('tenant_requests', col.name, col.spec as never);
      logger.info(`[ensureSchema] Column tenant_requests.${col.name} added`);
    }
  } catch {
    // la tabla aún no existe — sync la crea completa
  }

  const poColumns = await qi.describeTable('purchase_orders');
  if (!('affectsStock' in poColumns)) {
    await qi.addColumn('purchase_orders', 'affectsStock', {
      type: DataType.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    } as never);
    logger.info('[ensureSchema] Column purchase_orders.affectsStock added');
  }

  // IVA por producto (v1.18.0): la orden toma el IVA de la ficha en vez de
  // arrancar en 0 en cada línea. Al crear la columna se rellena con el último
  // IVA con que se vendió cada producto (lo que el vendedor ya venía usando);
  // los nunca vendidos quedan en 0, igual que antes.
  const productCols = await qi.describeTable('products');
  if (!('taxRate' in productCols)) {
    await qi.addColumn('products', 'taxRate', {
      type: DataType.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    } as never);
    await sequelize.query(`
      UPDATE products p
      JOIN (
        SELECT oi.productId, oi.taxRate
        FROM order_items oi
        JOIN (SELECT productId, MAX(id) AS lastId FROM order_items GROUP BY productId) last
          ON last.lastId = oi.id
      ) t ON t.productId = p.id
      SET p.taxRate = t.taxRate
    `);
    logger.info('[ensureSchema] Column products.taxRate added (backfilled from last sale)');
  }
  // v1.19.1: por producto, si el precio de venta ya incluye el IVA. Los
  // existentes quedan en true (el cliente confirmó que sus precios lo incluyen):
  // así órdenes/cotizaciones no suman IVA encima de un precio que ya lo trae.
  if (!('priceIncludesTax' in productCols)) {
    await qi.addColumn('products', 'priceIncludesTax', {
      type: DataType.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    } as never);
    logger.info('[ensureSchema] Column products.priceIncludesTax added');
  }

  if (missing.length === 0) {
    logger.info('[ensureSchema] Schema up to date');
  }
}
