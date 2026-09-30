import { Op } from 'sequelize';
import { Tenant } from './tenant.model';
import { User } from '../user/user.model';
import { Product } from '../product/product.model';
import { Order } from '../order/order.model';
import { AppError } from '@/core/errors/AppError';
import { config } from '@/config';

export type LimitedResource = 'users' | 'products' | 'ordersPerMonth';

const LABELS: Record<LimitedResource, string> = {
  users: 'usuarios',
  products: 'productos',
  ordersPerMonth: 'órdenes este mes',
};

/**
 * Verifica que el tenant no haya alcanzado el límite de su plan antes de crear un recurso.
 * No-op salvo que ENFORCE_PLAN_LIMITS=true, para no afectar tenants existentes.
 */
export async function assertWithinPlanLimit(tenantId: number, resource: LimitedResource): Promise<void> {
  if (!config.saas.enforcePlanLimits) return;

  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) return;

  let current: number;
  let max: number;

  switch (resource) {
    case 'users':
      max = tenant.maxUsers;
      current = await User.count({ where: { tenantId } });
      break;
    case 'products':
      max = tenant.maxProducts;
      current = await Product.count({ where: { tenantId } });
      break;
    case 'ordersPerMonth': {
      max = tenant.maxOrdersPerMonth;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      current = await Order.count({ where: { tenantId, createdAt: { [Op.gte]: monthStart } } });
      break;
    }
  }

  if (current >= max) {
    throw new AppError(
      `Alcanzaste el límite de tu plan (${max} ${LABELS[resource]}). Mejora tu plan para continuar.`,
      402
    );
  }
}
