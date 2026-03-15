import { create } from 'zustand';
import { usersService } from '../services/users';
import { User, CreateUserRequest, UpdateUserRequest } from '../types/auth';
import { userRepository } from '../repositories/UserRepository';

interface UserState {
  users: User[];
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  
  // Actions
  getUsers: (page?: number, limit?: number) => Promise<void>;
  getUserById: (id: number) => Promise<void>;
  createUser: (userData: CreateUserRequest) => Promise<void>;
  updateUser: (id: number, userData: UpdateUserRequest) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  restoreUser: (id: number) => Promise<void>;
  clearError: () => void;
  clearCurrentUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  users: [],
  currentUser: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },

  getUsers: async (page = 1, limit = 10) => {
    set({ loading: true, error: null });
    try {
      if (navigator.onLine) {
        const response = await usersService.getUsers(page, limit);
        // Cache-on-fetch: guardar en IndexedDB
        userRepository.saveAllFromServer(response.data).catch(() => {});
        set({ users: response.data, pagination: response.pagination, loading: false });
        return;
      }
      // Offline: leer de IndexedDB
      const localUsers = await userRepository.getAll();
      set({
        users: localUsers.map(u => ({
          id: u.serverId || u.id,
          username: u.username,
          role: u.role as 'buyer' | 'seller' | 'admin',
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        })),
        loading: false,
      });
    } catch (error: unknown) {
      let errorMessage = 'Error al cargar usuarios';

      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      set({ error: errorMessage, loading: false });
    }
  },

  getUserById: async (id: number) => {
    set({ loading: true, error: null });
    try {
      if (navigator.onLine) {
        const user = await usersService.getUserById(id);
        // Cache-on-fetch: guardar en IndexedDB
        userRepository.saveFromServer(user).catch(() => {});
        set({ currentUser: user, loading: false });
        return;
      }
      // Offline: leer de IndexedDB por serverId
      const localUser = await userRepository.getByServerId(id);
      if (localUser) {
        set({
          currentUser: {
            id: localUser.serverId || localUser.id,
            username: localUser.username,
            role: localUser.role as 'buyer' | 'seller' | 'admin',
            createdAt: localUser.createdAt,
            updatedAt: localUser.updatedAt,
          },
          loading: false,
        });
      } else {
        throw new Error('Usuario no disponible offline');
      }
    } catch (error: unknown) {
      let errorMessage = 'Error al cargar usuario';

      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      set({ error: errorMessage, loading: false });
    }
  },

  createUser: async (userData: CreateUserRequest) => {
    set({ loading: true, error: null });
    try {
      const newUser = await usersService.createUser(userData);
      set(state => ({
        users: [...state.users, newUser],
        pagination: {
          ...state.pagination,
          total: state.pagination.total + 1,
        },
        loading: false,
      }));
    } catch (error: unknown) {
      let errorMessage = 'Error al crear usuario';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updateUser: async (id: number, userData: UpdateUserRequest) => {
    set({ loading: true, error: null });
    try {
      const updatedUser = await usersService.updateUser(id, userData);
      set(state => ({
        users: state.users.map(user => 
          user.id === id ? updatedUser : user
        ),
        currentUser: state.currentUser?.id === id ? updatedUser : state.currentUser,
        loading: false,
      }));
    } catch (error: unknown) {
      let errorMessage = 'Error al actualizar usuario';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteUser: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await usersService.deleteUser(id);
      set(state => ({
        users: state.users.filter(user => user.id !== id),
        loading: false,
      }));
    } catch (error: unknown) {
      let errorMessage = 'Error al eliminar usuario';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  restoreUser: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await usersService.restoreUser(id);
      set(state => ({
        users: state.users.filter(user => user),
        loading: false,
      }));
    } catch (error: unknown) {
      let errorMessage = 'Error al resaurar usuario';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentUser: () => set({ currentUser: null }),
})); 