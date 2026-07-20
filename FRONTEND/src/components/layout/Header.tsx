import { useState } from 'react';
import { User, LogOut, Package, Shield, Bell, BellOff, CloudOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSyncStore } from '../../store/syncStore';
import { useOrderStore } from '../../store/orderStore';
import { useCustomerStore } from '../../store/customerStore';
import { useTenantStore } from '../../store/tenantStore';
import InstallButton from '../ui/InstallButton';
import TopLoadingBar from '../ui/TopLoadingBar';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const Header = () => {
  const { user, logout } = useAuthStore();
  const { tenant } = useTenantStore();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { status, current, total } = useSyncStore();
  const { pendingSync: pendingOrders } = useOrderStore();
  const { pendingSync: pendingCustomers } = useCustomerStore();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, toggle: togglePush } = usePushNotifications();

  const totalPending = pendingOrders + pendingCustomers;
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsUserMenuOpen(false);
  };

  const toggleUserMenu = () => setIsUserMenuOpen((v) => !v);
  const closeUserMenu = () => setIsUserMenuOpen(false);

  return (
    <header className="md:hidden bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50 pt-safe">
      <TopLoadingBar />
      <div className="px-4">
        <div className="flex justify-between items-center h-14">

          {/* Logo + sync state */}
          <Link to="/" className="flex items-center gap-2 group" aria-label="Ir al inicio">
            <div className="p-1.5 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              {tenant?.logoUrl
                ? <img src={tenant.logoUrl} alt={tenant.name} className="w-5 h-5 object-contain" />
                : <Package className="w-5 h-5 text-primary" />}
            </div>
            <span className="text-lg font-bold text-gray-900">{tenant?.name ?? 'Merco'}</span>

            {/* Syncing progress */}
            {status === 'syncing' && (
              <span className="text-xs text-blue-400 font-normal">{percent}%</span>
            )}
            {status === 'done' && (
              <span className="text-xs text-green-500 font-normal">&#10003;</span>
            )}

            {/* Pending badge — items waiting to sync */}
            {totalPending > 0 && status !== 'syncing' && (
              <span
                title={`${totalPending} elemento${totalPending > 1 ? 's' : ''} pendiente${totalPending > 1 ? 's' : ''} de sincronizar`}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold leading-none"
              >
                <CloudOff className="w-2.5 h-2.5" />
                {totalPending > 99 ? '99+' : totalPending}
              </span>
            )}
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-1">

            {/* Push notifications */}
            {pushSupported && (
              <button
                onClick={togglePush}
                disabled={pushLoading}
                title={pushSubscribed ? 'Desactivar notificaciones' : 'Activar notificaciones'}
                className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {pushSubscribed
                  ? <Bell className="w-5 h-5 text-primary" />
                  : <BellOff className="w-5 h-5" />}
              </button>
            )}

            {/* Avatar with pending dot */}
            {user && (
              <div className="relative">
                <button
                  onClick={toggleUserMenu}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                  className="relative w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-sm"
                >
                  <User className="w-4 h-4 text-white" />
                  {/* green = online & synced, orange = has pending */}
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      totalPending > 0 ? 'bg-orange-500' : 'bg-green-500'
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={closeUserMenu} aria-hidden="true" />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50">

                      {/* User info */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-sm shrink-0">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{user.username}</p>
                            <p className="text-xs text-gray-500 capitalize flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              <span>{user.role}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Pending sync info */}
                      {totalPending > 0 && (
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-xs text-orange-600 flex items-center gap-1.5">
                            <CloudOff className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {totalPending} elemento{totalPending > 1 ? 's' : ''} sin sincronizar
                            </span>
                          </p>
                        </div>
                      )}

                      {/* Install button */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <InstallButton />
                      </div>

                      {/* Logout */}
                      <div className="pt-1">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors active:bg-red-100"
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
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
