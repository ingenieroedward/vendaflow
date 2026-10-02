import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Save, Shield, Eye, EyeOff } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { CreateUserRequest } from '../types/auth';

interface UserFormData {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
  role: 'admin' | 'buyer' | 'seller';
}

const UserNew: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { createUser, loading } = useUserStore();
  const { addNotification } = useUIStore();
  
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'buyer',
  });
  const [errors, setErrors] = useState<Partial<UserFormData>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Check if current user is admin
  if (currentUser?.role !== 'admin') {
    return (
      <div className="bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <Shield className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Acceso denegado
            </h3>
            <p className="text-gray-500 mb-6">
              No tienes permisos para acceder a esta sección
            </p>
            <Button variant="primary" onClick={() => navigate('/')}>
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<UserFormData> = {};

    if (!formData.username.trim()) {
      newErrors.username = 'El nombre de usuario es requerido';
    } else if (formData.username.length < 3) {
      newErrors.username = 'El nombre de usuario debe tener al menos 3 caracteres';
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirma la contraseña';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name as keyof UserFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      const userData: CreateUserRequest = {
        name: formData.name.trim() || undefined,
        username: formData.username.trim(),
        password: formData.password,
        role: formData.role,
      };
      
      await createUser(userData);
      
      addNotification({
        type: 'success',
        title: 'Usuario creado',
        message: 'El usuario se ha creado correctamente',
      });
      
      navigate('/users');
    } catch {
      // Error is handled by the store
    }
  };

  const handleBack = () => {
    navigate('/users');
  };

  return (
    <div className="bg-gray-50">
      <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-2xl mx-auto">
        {/* Mobile Header - Compact */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={handleBack}
            className="mb-3 sm:mb-4 -ml-2"
            size="sm"
          >
            Volver
          </Button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
                  Nuevo usuario
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                  Crea un nuevo usuario en el sistema
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form - Mobile Optimized */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Information */}
            <div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 flex items-center">
                <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Información del usuario
              </h3>
              {/* Mobile: Stack inputs vertically */}
              <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Nombre completo"
                    name="name"
                    type="text"
                    value={formData.name || ''}
                    onChange={handleInputChange}
                    placeholder="Opcional"
                    autoFocus
                  />
                </div>

                <div className="sm:col-span-1">
                  <Input
                    label="Nombre de usuario"
                    name="username"
                    type="text"
                    value={formData.username || ''}
                    onChange={handleInputChange}
                    error={errors.username}
                    placeholder="Ingresa el nombre de usuario"
                  />
                </div>

                <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rol del usuario
                </label>
                <select
                  name="role"
                  value={formData.role || 'buyer'}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                >
                  <option value="buyer">Comprador</option>
                  <option value="seller">Vendedor</option>
                  <option value="admin">Administrador</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Los administradores pueden gestionar usuarios y acceder a todas las funciones del sistema.
                </p>
              </div>
              </div>
            </div>

            {/* Password Section */}
            <div className="border-t pt-6">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Contraseña  
              </h3>
              {/* Mobile: Stack password fields vertically */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                      placeholder="Ingresa la contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                      placeholder="Confirma la contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              
            </div>

            {/* Mobile: Stack buttons vertically, make them full width */}
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={loading}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                icon={Save}
                loading={loading}
                disabled={loading}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {loading ? 'Creando...' : 'Crear usuario'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserNew; 