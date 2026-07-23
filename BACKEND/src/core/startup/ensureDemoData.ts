import { User } from '@/modules/user/user.model';
import { Tenant } from '@/modules/tenant/tenant.model';
import logger from '@/core/logger';

/**
 * Ensures the demo tenant and demo_admin user exist with known credentials.
 * Safe to run on every startup — idempotent.
 */
export async function ensureDemoData(): Promise<void> {
  const demoPassword = process.env['DEMO_ADMIN_PASSWORD'];
  if (!demoPassword) {
    logger.info('DEMO_ADMIN_PASSWORD not set — skipping demo data setup');
    return;
  }

  const [demoTenant] = await Tenant.findOrCreate({
    where: { slug: 'demo' },
    defaults: {
      slug: 'demo',
      name: 'Demo',
      plan: 'pro',
      status: 'active',
      maxUsers: 10,
      maxProducts: 500,
      maxOrdersPerMonth: 1000,
    } as any,
  });

  const demoUser = await User.findOne({
    where: { username: 'demo_admin', tenantId: demoTenant.id },
    paranoid: false,
  });

  if (demoUser) {
    demoUser.password = demoPassword;
    if (demoUser.deletedAt) await (demoUser as any).restore();
    await demoUser.save();
    logger.info(`Demo user "demo_admin" password updated (tenant: demo)`);
  } else {
    await User.create({
      tenantId: demoTenant.id,
      username: 'demo_admin',
      password: demoPassword,
      role: 'admin',
    } as any);
    logger.info(`Demo user "demo_admin" created (tenant: demo)`);
  }
}
