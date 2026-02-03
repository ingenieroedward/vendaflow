import { BaseRepository } from './BaseRepository';
import { db, LocalUser } from '../database/LocalDatabase';

/**
 * Server User interface (from API)
 */
export interface ServerUser {
  id: number;
  username: string;
  role: 'buyer' | 'seller' | 'admin';
  createdAt?: string;
  updatedAt?: string;
}

/**
 * DTO for creating users
 */
export interface CreateUserDTO {
  username: string;
  role: 'buyer' | 'seller' | 'admin';
}

/**
 * User transformations
 */
export const UserTransform = {
  fromServer(serverData: ServerUser, userId?: number): Omit<LocalUser, 'id'> {
    return {
      serverId: serverData.id,
      username: serverData.username,
      role: serverData.role,
      createdAt: serverData.createdAt || new Date().toISOString(),
      updatedAt: serverData.updatedAt || new Date().toISOString(),
      _syncStatus: 'SYNCED',
      _version: 1,
      _lastModifiedAt: Date.now(),
      _lastModifiedBy: userId,
    };
  },

  toServer(localData: LocalUser): Partial<ServerUser> {
    return {
      id: localData.serverId,
      username: localData.username,
      role: localData.role,
    };
  }
};

/**
 * User validation
 */
export const UserValidation = {
  validate(data: CreateUserDTO): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.username || data.username.trim() === '') {
      errors.push('Username es requerido');
    }

    if (!data.role) {
      errors.push('Role es requerido');
    }

    if (data.role && !['buyer', 'seller', 'admin'].includes(data.role)) {
      errors.push('Role inválido');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

/**
 * Repository for User entities
 */
export class UserRepository extends BaseRepository<
  LocalUser,
  ServerUser,
  CreateUserDTO
> {
  constructor() {
    super(db.users, 'User');
  }

  protected transformFromServer(serverData: ServerUser, userId?: number): Omit<LocalUser, 'id'> {
    return UserTransform.fromServer(serverData, userId);
  }

  protected transformToServer(localData: LocalUser): Partial<ServerUser> {
    return UserTransform.toServer(localData);
  }

  protected validate(data: CreateUserDTO): { valid: boolean; errors: string[] } {
    return UserValidation.validate(data);
  }

  /**
   * Search users by username
   */
  async search(searchTerm: string): Promise<LocalUser[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAll();
    }

    const term = searchTerm.toLowerCase().trim();

    return await this.table
      .filter(user =>
        !user.deletedAt &&
        user.username.toLowerCase().includes(term)
      )
      .toArray();
  }

  /**
   * Get user by username
   */
  async getByUsername(username: string): Promise<LocalUser | undefined> {
    return await this.table
      .where('username')
      .equals(username)
      .filter(user => !user.deletedAt)
      .first();
  }

  /**
   * Get users by role
   */
  async getByRole(role: 'buyer' | 'seller' | 'admin'): Promise<LocalUser[]> {
    return await this.table
      .filter(user => !user.deletedAt && user.role === role)
      .toArray();
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
