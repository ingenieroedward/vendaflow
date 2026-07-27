import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useTenantStore } from '../store/tenantStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { LoginRequest } from '../types/auth';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading, user } = useAuthStore();
  const { addNotification } = useUIStore();
  const { tenant } = useTenantStore();

  const [formData, setFormData] = useState<LoginRequest>({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<LoginRequest>>({});

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === 'superadmin') { window.location.replace('https://admin.merco.edwsystem.com'); return; }
      navigate('/');
    }
  }, [isAuthenticated, navigate, user]);

  // Impersonación desde el panel superadmin: /login?impersonate=<token>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('impersonate');
    if (!token) return;
    (async () => {
      const { STORAGE_KEYS } = await import('../utils/constants');
      try {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
        const { apiService } = await import('../services/api');
        const me = await apiService.get<{ status: string; data: { id: number; username: string; role: string; tenantId: number } }>('/auth/me');
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(me.data));
        window.location.replace('/'); // recarga limpia con la sesión ya persistida
      } catch {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      }
    })();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginRequest> = {};

    if (!formData.username.trim()) {
      newErrors.username = 'El usuario es requerido';
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name as keyof LoginRequest]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await login(formData);
      addNotification({
        type: 'success',
        title: 'Bienvenido',
        message: 'Has iniciado sesión correctamente',
      });
      const { user: loggedUser } = useAuthStore.getState();
      if (loggedUser?.role === 'superadmin') { window.location.replace('https://admin.merco.edwsystem.com'); return; }
      navigate('/');
    } catch (error: unknown) {
      let errorMessage = 'Credenciales incorrectas';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      addNotification({
        type: 'error',
        title: 'Error de autenticación',
        message: errorMessage,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-sm sm:max-w-md w-full space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center">
              {tenant?.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.name} className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded-xl" />
              ) : (
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
              )}
            </div>
            <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-bold text-gray-900">
              {tenant?.name ?? 'Merco'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Gestión de productos y precios
            </p>
          </div>

          {/* Login Form */}
          <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 text-center">
                Iniciar Sesión
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <Input
                label="Usuario"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                error={errors.username}
                placeholder="Ingresa tu usuario"
                autoComplete="username"
                autoFocus
              />

              <div className="relative">
                <Input
                  label="Contraseña"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  error={errors.password}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-1 top-7 sm:top-8 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Button
                type="submit"
                className="w-full"
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>
            <p className="text-center text-xs text-gray-400 mt-4">
              ¿No tienes cuenta?{' '}
              <a href="/registro" className="text-blue-600 hover:underline font-medium">Solicita tu prueba gratis</a>
            </p>

            
          </div>
           {/* Footer */}
      <div className=" px-4 sm:px-6 lg:px-8">
        <div className="max-w-sm sm:max-w-md mx-auto text-center space-y-2">
         
          <div className="block  flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-4 text-xs text-gray-400">
            <span>© {new Date().getFullYear()} {tenant?.name ?? 'Merco'}. Todos los derechos reservados.</span>
            <br />
            <span>
              Desarrollado por{' '}
              <a 
                href="https://edwsystem.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors duration-200 font-medium"
              >
                Edwsystem
              </a>
            </span>
          </div>
        </div>
      </div>
        </div>

      </div>

     
    </div>
  );
};

export default Login;