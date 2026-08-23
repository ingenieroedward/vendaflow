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
  name?: string;
  username: string;
  password: string;
  role: 'admin' | 'buyer' | 'seller';
}

export interface UpdateUserRequest {
  name?: string;
  username?: string;
  password?: string;
  role?: 'admin' | 'buyer' | 'seller';
}

export interface UpdateOwnProfileRequest {
  name?: string;
  username?: string;
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
  // solo llega de /tenants/me (autenticado) — features del plan (ver FeatureGate/useFeature)
  features?: string[];
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
  name?: string | null;
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
  /** Actualiza el usuario en memoria y localStorage — ej. tras guardar el perfil */
  setUser: (user: User) => void;
}