import bcrypt from 'bcryptjs';
import { User } from '@/modules/user/user.model';
import { Tenant } from '@/modules/tenant/tenant.model';
import logger from '@/core/logger';

export async function ensureSuperadmin(): Promise<void> {
  const username = process.env['SUPERADMIN_USERNAME'];
  const password = process.env['SUPERADMIN_PASSWORD'];

  if (!username || !password) {
    if (process.env['NODE_ENV'] === 'production') {
      logger.warn('SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD not set — superadmin not created');
    }
    return;
  }

  const existing = await User.findOne({ where: { username, role: 'superadmin' } });
  if (existing) {
    logger.info(`Superadmin "${username}" already exists — skipping`);
    return;
  }

  // Ensure the internal platform tenant exists (superadmin must belong to some tenant)
  const [platformTenant] = await Tenant.findOrCreate({
    where: { slug: 'platform' },
    defaults: {
      slug: 'platform',
      name: 'Merco Platform',
      plan: 'enterprise',
      status: 'active',
      maxUsers: 999,
      maxProducts: 999999,
      maxOrdersPerMonth: 999999,
    } as any,
  });

  const hashed = await bcrypt.hash(password, 10);
  await User.create({
    tenantId: platformTenant.id,
    username,
    password: hashed,
    role: 'superadmin',
  } as any, { hooks: false });

  logger.info(`Superadmin "${username}" created (tenant: platform)`);
}
