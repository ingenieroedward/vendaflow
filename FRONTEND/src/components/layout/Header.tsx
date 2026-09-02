import { useState, useEffect } from 'react';
import { User, LogOut, Package, Shield, CloudOff, Download, AlertTriangle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSyncStore } from '../../store/syncStore';
import { useOrderStore } from '../../store/orderStore';
import { useCustomerStore } from '../../store/customerStore';
import { useTenantStore } from '../../store/tenantStore';
import { useTenantRenewalStatus } from '../../hooks/useTenantRenewalStatus';
import InstallModal from '../ui/InstallModal';
import TopLoadingBar from '../ui/TopLoadingBar';

const Header = () => {
  const { user, logout } = useAuthStore();
  const { tenant } = useTenantStore();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { status, current, total } = useSyncStore();
  const { pendingSync: pendingOrders } = useOrderStore();
  const { pendingSync: pendingCustomers } = useCustomerStore();
  const { trialDaysLeft, renewalDaysLeft } = useTenantRenewalStatus();

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const totalPending = pendingOrders + pendingCustomers;
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsUserMenuOpen(false);
  };

  const toggleUserMenu = () => setIsUserMenuOpen((v) => !v);
  const closeUserMenu = () => setIsUserMenuOpen(false);

  // Abreviación de 2-4 letras para el header mobile: "Distribuciones Imperium SAS" → "DIS"
  const shortName = tenant?.name
    ? tenant.name.split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 4)
    : 'M';

  return (
    <>
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
            <span
              className="text-lg font-bold text-primary tracking-widest"
              title={tenant?.name}
            >
              {shortName}
            </span>

            {/* Syncing progress */}
            {status === 'syncing' && (
              <span className="text-xs text-primary/70 font-normal">{percent}%</span>
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

            {/* Install / Help button — always visible */}
            <button
              onClick={() => setIsInstallOpen(true)}
              title="Instalar app"
              className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>

            {/* Avatar with pending dot */}
            {user && (
              <div className="relative">
                <button
                  onClick={toggleUserMenu}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                  className="relative w-9 h-9 bg-gradient-to-br from-primary/70 to-primary rounded-full flex items-center justify-center shadow-sm"
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
                          <div className="w-9 h-9 bg-gradient-to-br from-primary/70 to-primary rounded-full flex items-center justify-center shadow-sm shrink-0">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{user.name || user.username}</p>
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

                      {/* Install / Help */}
                      <div className="px-2 py-1 border-b border-gray-100">
                        <button
                          onClick={() => { closeUserMenu(); setIsInstallOpen(true); }}
                          className="flex items-center gap-3 w-full px-2 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                        >
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Download className="w-4 h-4 text-primary" />
                          </div>
                          <span>Instalar app / Ayuda</span>
                        </button>
                      </div>

                      <div className="pt-1">
                        <Link
                          to="/profile"
                          onClick={closeUserMenu}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                        >
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                          <span>Mi perfil</span>
                        </Link>
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

      {/* Aviso de trial/plan por vencer o vencido — mismo cálculo que el
          banner de Sidebar.tsx (desktop), acá como franja siempre visible
          en vez de bloque lateral (no hay espacio para eso en mobile). */}
      {(trialDaysLeft !== null || renewalDaysLeft !== null) && (
        <Link
          to="/settings"
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium border-t ${
            renewalDaysLeft !== null && renewalDaysLeft < 0
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            {trialDaysLeft !== null
              ? (trialDaysLeft <= 0 ? 'Tu prueba vence HOY' : trialDaysLeft === 1 ? 'Tu prueba vence mañana' : `Tu prueba vence en ${trialDaysLeft} días`)
              : renewalDaysLeft !== null && renewalDaysLeft < 0
                ? `Tu plan venció hace ${-renewalDaysLeft} día${renewalDaysLeft === -1 ? '' : 's'}`
                : renewalDaysLeft === 0
                  ? 'Tu plan vence HOY'
                  : renewalDaysLeft === 1
                    ? 'Tu plan vence mañana'
                    : `Tu plan vence en ${renewalDaysLeft} días`}
          </span>
          <span className="ml-auto flex-shrink-0 underline">
            {renewalDaysLeft !== null && renewalDaysLeft < 0 ? 'Reportar pago' : 'Activar/renovar'}
          </span>
        </Link>
      )}
    </header>

    <InstallModal
      isOpen={isInstallOpen}
      onClose={() => setIsInstallOpen(false)}
      deferredPrompt={deferredPrompt}
      onInstalled={() => setDeferredPrompt(null)}
    />
    </>
  );
};

export default Header;
