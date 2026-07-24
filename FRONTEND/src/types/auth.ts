export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: 'admin' | 'buyer' | 'seller';
}

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  role?: 'admin' | 'buyer' | 'seller';
}

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  // plan y trialEndsAt solo llegan de endpoints autenticados (/tenants/me);
  // el endpoint público /tenants/slug/:slug ya no los expone
  plan?: string;
  status: string;
  logoUrl: string | null;
  primaryColor: string;
  trialEndsAt?: string | null;
}

export interface LoginResponse {
  data: {
    token: string;
    user: User;
    tenant?: Tenant;
  }
}

export interface UsersResponse {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'buyer' | 'seller';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}