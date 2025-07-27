import { useState } from 'react';
import { User, LogOut, Package, Shield, ChevronDown, Calendar } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Button from '../ui/Button';
import InstallButton from '../ui/InstallButton';

const Header = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsUserMenuOpen(false);
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  const closeUserMenu = () => {
    setIsUserMenuOpen(false);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Left section */}
          <div className="flex items-center space-x-3">
            
            
            <Link 
              to="/" 
              className="flex items-center space-x-2.5 group"
              aria-label="Ir al inicio"
            >
              <div className="p-1.5 rounded-xl bg-blue-50 group-hover:bg-blue-100 transition-colors duration-200">
                <Package className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" /> 
              </div>
              <span className="text-lg sm:text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                JJLM
              </span>
            </Link>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Navigation Links - Hidden on mobile, shown in user dropdown */}
            <div className="hidden md:flex items-center space-x-1">
              <Link
                to="/"
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200"
              >
                <Package className="w-4 h-4" />
                <span>Productos</span>
              </Link>
              <Link
                to="/orders"
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200"
              >
                <Calendar className="w-4 h-4" />
                <span>Órdenes</span>
              </Link>
              {user?.role === 'admin' && (
                <Link
                  to="/users"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200"
                >
                  <Shield className="w-4 h-4" />
                  <span>Usuarios</span>
                </Link>
              )}
            </div>
            
            {/* Install Button - More compact on mobile */}
            <div className="hidden sm:block">
              <InstallButton />
            </div>

            {user && (
              <div className="relative">
                {/* Desktop user menu */}
                <button
                  onClick={toggleUserMenu}
                  className="hidden sm:flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{user.username}</p>
                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                  </div>
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Mobile user button - Simple avatar only */}
                <button
                  onClick={toggleUserMenu}
                  className="sm:hidden relative w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-sm"
                >
                  <User className="w-5 h-5 text-white" />
                  {/* Active indicator dot */}
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                </button>

                {/* Desktop dropdown menu - Only for user settings */}
                {isUserMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={closeUserMenu}
                      aria-hidden="true"
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* User info header */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-base font-semibold text-gray-900">{user.username}</p>
                            <p className="text-sm text-gray-500 capitalize flex items-center space-x-1">
                              <Shield className="w-3 h-3" />
                              <span>{user.role}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Mobile navigation links - visible only on mobile */}
                      <div className="md:hidden border-b border-gray-100 py-2">
                        <Link
                          to="/"
                          onClick={closeUserMenu}
                          className="flex items-center space-x-3 w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <Package className="w-4 h-4" />
                          <span>Productos</span>
                        </Link>
                        <Link
                          to="/orders"
                          onClick={closeUserMenu}
                          className="flex items-center space-x-3 w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <Calendar className="w-4 h-4" />
                          <span>Órdenes</span>
                        </Link>
                        {user?.role === 'admin' && (
                          <Link
                            to="/users"
                            onClick={closeUserMenu}
                            className="flex items-center space-x-3 w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                          >
                            <Shield className="w-4 h-4" />
                            <span>Usuarios</span>
                          </Link>
                        )}
                        {/* Mobile Install Button */}
                        <div className="px-4 py-3">
                          <InstallButton />
                        </div>
                      </div>
                      
                      {/* User-specific options */}
                      {/* <div className="py-2">
                       
                        <Link
                          to="/profile"
                          onClick={closeUserMenu}
                          className="flex items-center space-x-3 w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                          <span>Mi Perfil</span>
                        </Link>
                      </div> */}
                      
                      {/* Logout button */}
                      <div className="border-t border-gray-100 pt-2">
                        <button
                          onClick={handleLogout}
                          className="flex items-center space-x-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-200 active:bg-red-100"
                        >
                          <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                            <LogOut className="w-4 h-4 text-red-600" />
                          </div>
                          <span>Cerrar sesión</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* Standalone logout button (fallback) */}
            {!user && (
              <Button
                variant="ghost"
                size="sm"
                icon={LogOut}
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 p-2.5 rounded-xl sm:px-3 sm:py-2 active:scale-95 transition-transform duration-150"
              >
                <span className="hidden sm:inline">Salir</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;