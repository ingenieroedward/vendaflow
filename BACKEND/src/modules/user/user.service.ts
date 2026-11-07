import { invalidateSession } from '@/core/auth/sessionCache';
import { User, UserAttributes } from "./user.model";
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UsersListResponseDto,
} from "./user.dto";
import { NotFoundError, ConflictError, UnauthorizedError, ValidationError } from "@/core/errors/AppError";
import {
  validateSchema,
  validatePartialSchema,
  paginationSchema,
  PaginationQuery,
} from "@/core/utils/validation";
import { createUserSchema, updateUserSchema, changePasswordSchema, ChangePasswordDto, updateOwnProfileSchema, UpdateOwnProfileDto } from "./user.dto";
import { Order } from "../order/order.model";
import { Price } from "../price/price.model";
import { StockMovement } from "../stock-movement/stock-movement.model";
import { Quote } from "../quote/quote.model";
import { PurchaseOrder } from "../purchase-order/purchase-order.model";
import { CashSession } from "../pos/cash-session.model";
import { PushSubscription } from "../push/push-subscription.model";

async function assertUserQuota(tenantId: number) {
  const { Tenant } = await import('@/modules/tenant/tenant.model');
  const { User } = await import('./user.model');
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) return;
  const count = await User.count({ where: { tenantId } });
  if (count >= tenant.maxUsers) {
    throw new ConflictError(`Tu plan permite máximo ${tenant.maxUsers} usuarios. Actualiza el plan para agregar más.`);
  }
}

export class UserService {
  async createUser(userData: CreateUserDto, tenantId: number): Promise<UserResponseDto> {
    const validatedData = validateSchema(createUserSchema, userData);
    await assertUserQuota(tenantId);

    const existingUser = await User.findOne({
      where: { tenantId, username: validatedData.username },
    });
    if (existingUser) {
      throw new ConflictError("User with this username already exists");
    }

    const user = await User.create({ ...validatedData, tenantId } as UserAttributes);
    return this.mapToResponseDto(user);
  }

  async getAllUsers(query: PaginationQuery, tenantId: number): Promise<UsersListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await User.findAndCountAll({
      where: { tenantId },
      limit: validatedLimit,
      offset,
      order: [["createdAt", "DESC"]],
      paranoid: false,
    });

    const users = rows.map((user) => this.mapToResponseDto(user));
    const totalPages = Math.ceil(Number(count) / validatedLimit);

    return {
      users,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages,
      },
    };
  }

  async getUserById(id: number, tenantId: number): Promise<UserResponseDto> {
    const user = await User.findOne({ where: { id, tenantId } });
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return this.mapToResponseDto(user);
  }

  // Cambio de contraseña propia: cualquier rol, exige la contraseña actual
  // Cierra las demás sesiones (sube tokenVersion) y devuelve el usuario para que el
  // controller emita un token nuevo — quien cambió la clave sigue trabajando.
  async changeOwnPassword(userId: number, data: ChangePasswordDto): Promise<User> {
    const validatedData = validateSchema(changePasswordSchema, data);
    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');
    const valid = await user.comparePassword(validatedData.currentPassword);
    if (!valid) throw new UnauthorizedError('La contraseña actual es incorrecta');
    await user.update({ password: validatedData.newPassword, tokenVersion: (user.tokenVersion ?? 0) + 1 }); // @BeforeUpdate la hashea
    invalidateSession(user.id);
    return user;
  }

  // Perfil propio: cualquier rol, solo nombre/usuario (ver updateOwnProfileSchema)
  async updateOwnProfile(userId: number, tenantId: number, data: UpdateOwnProfileDto): Promise<UserResponseDto> {
    const validatedData = validateSchema(updateOwnProfileSchema, data);
    const user = await User.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundError('User not found');

    if (validatedData.username && validatedData.username !== user.username) {
      const existingUser = await User.findOne({ where: { tenantId, username: validatedData.username } });
      if (existingUser) throw new ConflictError('User with this username already exists');
    }

    await user.update(validatedData as Partial<UserAttributes>);
    return this.mapToResponseDto(user);
  }

  async updateUser(id: number, updateData: UpdateUserDto, tenantId: number): Promise<UserResponseDto> {
    const validatedData = validatePartialSchema(updateUserSchema, updateData) as Partial<UpdateUserDto>;

    const user = await User.findOne({ where: { id, tenantId } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (validatedData.username && validatedData.username !== user.username) {
      const existingUser = await User.findOne({
        where: { tenantId, username: validatedData.username },
      });
      if (existingUser) {
        throw new ConflictError("User with this username already exists");
      }
    }

    // Cambiar rol o contraseña (reset del admin) cierra las sesiones abiertas del usuario
    const revoke = (validatedData.role !== undefined && validatedData.role !== user.role) || !!validatedData.password;
    await user.update({
      ...(validatedData as any),
      ...(revoke && { tokenVersion: (user.tokenVersion ?? 0) + 1 }),
    });
    if (revoke) invalidateSession(user.id);
    return this.mapToResponseDto(user);
  }

  /**
   * Elimina un usuario con lógica en dos pasos:
   *
   * 1. SOFT DELETE (primer llamado): si el usuario está activo, lo marca como eliminado (deletedAt).
   *
   * 2. HARD DELETE (segundo llamado, cuando deletedAt ya existe):
   *    - Si tiene precios asignados: requiere `transferToAdminId` para reasignarlos antes de borrar.
   *    - Si tiene órdenes creadas: requiere `transferToAdminId` para reasignarlas antes de borrar.
   *    - Si no hay conflictos: elimina físicamente el registro.
   *
   * @param transferToAdminId  ID del admin que absorbe los precios y órdenes del usuario eliminado.
   */
  async deleteUser(id: number, tenantId: number, transferToAdminId?: number): Promise<void> {
    // transferTo debe ser un admin del mismo tenant (antes podía ser cualquier
    // usuario, incluso de otro tenant — auditoría nov 2026)
    if (transferToAdminId !== undefined) {
      const target = await User.findOne({ where: { id: transferToAdminId, tenantId, role: 'admin' } });
      if (!target) throw new ValidationError('El usuario que recibe las órdenes y precios debe ser un admin de esta empresa');
    }
    const user = await User.findOne({
      where: { id, tenantId },
      paranoid: false,
      // paranoid: false en los includes para detectar TODOS los registros,
      // incluyendo soft-deleted, que aún referencian al usuario vía FK en MySQL.
      include: [
        { model: Order, paranoid: false },
        { model: Price, paranoid: false },
      ],
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.deletedAt) {
      if (user.prices?.length > 0) {
        if (!transferToAdminId) {
          throw new ConflictError("El usuario tiene precios asignados");
        }
        // Reasignar precios al admin que elimina (incluye soft-deleted para liberar FK)
        await Price.update(
          { updatedByUserId: transferToAdminId },
          { where: { updatedByUserId: id }, paranoid: false }
        );
      }
      if (user.orders?.length > 0) {
        if (!transferToAdminId) {
          throw new ConflictError("El usuario tiene órdenes realizadas");
        }
        // Reasignar órdenes al admin que elimina
        await Order.update(
          { userId: transferToAdminId },
          { where: { userId: id }, paranoid: false }
        );
      }
      // El resto del historial que referencia al usuario (kardex, cotizaciones,
      // compras, turnos de caja) también se reasigna: antes solo se movían
      // órdenes y precios y la FK de stock_movements tumbaba el borrado con 500
      // para cualquier usuario que hubiera vendido algo.
      const where = { userId: id };
      const history = [StockMovement, Quote, PurchaseOrder, CashSession] as const;
      const counts = await Promise.all([
        StockMovement.count({ where }),
        Quote.count({ where, paranoid: false }),
        PurchaseOrder.count({ where, paranoid: false }),
        CashSession.count({ where }),
      ]);
      if (counts.some((c) => c > 0)) {
        if (!transferToAdminId) {
          throw new ConflictError("El usuario tiene historial de inventario, cotizaciones, compras o caja");
        }
        for (const M of history) {
          await (M as any).update({ userId: transferToAdminId }, { where, paranoid: false });
        }
      }
      // Las suscripciones push son del dispositivo del usuario: se borran, no se reasignan
      await PushSubscription.destroy({ where, force: true });
      invalidateSession(user.id);
      return await user.destroy({ force: true });
    }

    // Subir tokenVersion antes del soft delete: si luego se restaura, sus tokens
    // viejos no reviven
    await user.update({ tokenVersion: (user.tokenVersion ?? 0) + 1 });
    invalidateSession(user.id);
    return await user.destroy();
  }

  async restoreUser(id: number, tenantId: number): Promise<void> {
    const user = await User.findOne({ where: { id, tenantId }, paranoid: false });
    if (!user) {
      throw new NotFoundError("User not found")
    }
    await user.restore();
    invalidateSession(user.id);
  }

  private mapToResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }
}
