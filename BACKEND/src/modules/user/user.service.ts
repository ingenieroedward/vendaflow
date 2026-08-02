import { User, UserAttributes } from "./user.model";
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UsersListResponseDto,
} from "./user.dto";
import { NotFoundError, ConflictError, UnauthorizedError } from "@/core/errors/AppError";
import {
  validateSchema,
  validatePartialSchema,
  paginationSchema,
  PaginationQuery,
} from "@/core/utils/validation";
import { createUserSchema, updateUserSchema, changePasswordSchema, ChangePasswordDto } from "./user.dto";
import { Order } from "../order/order.model";
import { Price } from "../price/price.model";

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
  async changeOwnPassword(userId: number, data: ChangePasswordDto): Promise<void> {
    const validatedData = validateSchema(changePasswordSchema, data);
    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('User not found');
    const valid = await user.comparePassword(validatedData.currentPassword);
    if (!valid) throw new UnauthorizedError('La contraseña actual es incorrecta');
    await user.update({ password: validatedData.newPassword }); // @BeforeUpdate la hashea
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

    await user.update(validatedData as any);
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
      return await user.destroy({ force: true });
    }

    return await user.destroy();
  }

  async restoreUser(id: number, tenantId: number): Promise<void> {
    const user = await User.findOne({ where: { id, tenantId }, paranoid: false });
    if (!user) {
      throw new NotFoundError("User not found")
    }
    return await user.restore();
  }

  private mapToResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }
}
