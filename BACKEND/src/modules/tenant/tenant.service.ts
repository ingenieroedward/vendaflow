import { Tenant, TenantPlan, TenantAttributes } from './tenant.model';
import { User } from '../user/user.model';
import { Category } from '../category/category.model';
import { ConflictError, NotFoundError } from '@/core/errors/AppError';
import sequelize from '@/database';
import bcrypt from 'bcryptjs';

const PLAN_LIMITS: Record<TenantPlan, { maxUsers: number; maxProducts: number; maxOrdersPerMonth: number }> = {
  trial:      { maxUsers: 3,  maxProducts: 100,   maxOrdersPerMonth: 50   },
  basic:      { maxUsers: 3,  maxProducts: 500,   maxOrdersPerMonth: 200  },
  pro:        { maxUsers: 10, maxProducts: 5000,  maxOrdersPerMonth: 1000 },
  enterprise: { maxUsers: 999, maxProducts: 99999, maxOrdersPerMonth: 99999 },
};

export class TenantService {
  async create(data: {
    slug: string;
    name: string;
    plan?: TenantPlan;
    adminUsername: string;
    adminPassword: string;
    primaryColor?: string;
  }) {
    const existing = await Tenant.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictError(`Slug "${data.slug}" ya está en uso`);

    const plan: TenantPlan = data.plan ?? 'trial';
    const limits = PLAN_LIMITS[plan];
    const trialEndsAt = plan === 'trial' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;

    return sequelize.transaction(async (t: any) => {
      const tenant = await Tenant.create({
        slug: data.slug,
        name: data.name,
        plan,
        status: plan === 'trial' ? 'trial' : 'active',
        logoUrl: null,
        primaryColor: data.primaryColor ?? '#2563eb',
        trialEndsAt,
        ...limits,
      }, { transaction: t });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.adminPassword, salt);

      await User.create({
        tenantId: tenant.id,
        username: data.adminUsername,
        password: hashedPassword,
        role: 'admin',
      } as any, { transaction: t, hooks: false });

      await Category.create(
        { tenantId: tenant.id, name: 'Sin categoría' },
        { transaction: t }
      );

      return tenant;
    });
  }

  async findBySlug(slug: string) {
    const tenant = await Tenant.findOne({ where: { slug } });
    if (!tenant) throw new NotFoundError(`Tenant "${slug}" no encontrado`);
    return tenant;
  }

  async findById(id: number) {
    const tenant = await Tenant.findByPk(id);
    if (!tenant) throw new NotFoundError('Tenant no encontrado');
    return tenant;
  }

  // Versión pública de getInfo — solo lo necesario para theming del login.
  // No expone plan, trial ni límites (GET /tenants/slug/:slug es público)
  async getPublicInfo(tenantId: number) {
    const tenant = await this.findById(tenantId);
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor ?? '#2563eb',
    };
  }

  async getInfo(tenantId: number) {
    const tenant = await this.findById(tenantId);
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor ?? '#2563eb',
      trialEndsAt: tenant.trialEndsAt,
      maxUsers: tenant.maxUsers,
      maxProducts: tenant.maxProducts,
      maxOrdersPerMonth: tenant.maxOrdersPerMonth,
    };
  }

  async updateTheme(tenantId: number, data: { primaryColor?: string; logoUrl?: string | null; name?: string }) {
    const tenant = await this.findById(tenantId);
    await tenant.update(data);
    return tenant;
  }

  async suspend(tenantId: number) {
    const tenant = await this.findById(tenantId);
    await tenant.update({ status: 'suspended' });
    return tenant;
  }

  async activate(tenantId: number) {
    const tenant = await this.findById(tenantId);
    await tenant.update({ status: 'active' });
    return tenant;
  }

  async update(tenantId: number, data: {
    name?: string | undefined;
    plan?: TenantPlan | undefined;
    trialEndsAt?: string | null | undefined;
    maxUsers?: number | undefined;
    maxProducts?: number | undefined;
    maxOrdersPerMonth?: number | undefined;
  }) {
    const tenant = await this.findById(tenantId);
    const updates: Partial<TenantAttributes> = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.trialEndsAt !== undefined) updates.trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null;
    if (data.maxUsers !== undefined) updates.maxUsers = data.maxUsers;
    if (data.maxProducts !== undefined) updates.maxProducts = data.maxProducts;
    if (data.maxOrdersPerMonth !== undefined) updates.maxOrdersPerMonth = data.maxOrdersPerMonth;

    if (data.plan !== undefined && data.plan !== tenant.plan) {
      const limits = PLAN_LIMITS[data.plan];
      updates.plan = data.plan;
      updates.maxUsers = data.maxUsers ?? limits.maxUsers;
      updates.maxProducts = data.maxProducts ?? limits.maxProducts;
      updates.maxOrdersPerMonth = data.maxOrdersPerMonth ?? limits.maxOrdersPerMonth;
      if (data.plan !== 'trial') updates.trialEndsAt = null;
      if (tenant.status === 'trial' && data.plan !== 'trial') updates.status = 'active';
    }

    await tenant.update(updates);
    return tenant;
  }

  async listAll() {
    return Tenant.findAll({ order: [['createdAt', 'DESC']] });
  }

  getPlanLimits(plan: TenantPlan) {
    return PLAN_LIMITS[plan];
  }
}
