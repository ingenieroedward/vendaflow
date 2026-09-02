import { useEffect, useState } from 'react';
import { Package, ClipboardList, Users, LogOut, User, Shield, Truck, Tag, DollarSign, UserCheck, BarChart2, Warehouse, ShoppingCart, Settings, AlertTriangle, Store, FileText } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useTenantStore } from '../../store/tenantStore';
import { getMyTenant } from '../../services/tenant';

interface NavItem {
  label: string;
  to: string;
  icon: React.FC<{ className?: string }>;
  roles: string[];
  feature?: string; // si se define, solo se muestra si el tenant tiene esa feature del plan
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Productos', to: '/', icon: Package, roles: ['buyer', 'seller', 'admin'] },
  { label: 'Precios', to: '/prices', icon: DollarSign, roles: ['buyer', 'admin'] },
  { label: 'Proveedores', to: '/suppliers', icon: Truck, roles: ['buyer', 'admin'] },
  { label: 'Categorías', to: '/categories', icon: Tag, roles: ['buyer', 'admin'] },
  { label: 'Clientes', to: '/customers', icon: UserCheck, roles: ['seller', 'admin'] },
  { label: 'Órdenes', to: '/orders', icon: ClipboardList, roles: ['seller', 'admin'] },
  { label: 'Cotizaciones', to: '/quotes', icon: FileText, roles: ['seller', 'admin'], feature: 'quotes' },
  { label: 'Punto de venta', to: '/pos', icon: Store, roles: ['seller', 'admin'], feature: 'pos' },
  { label: 'Inventario', to: '/inventory', icon: Warehouse, roles: ['seller', 'admin'] },
  { label: 'Órdenes Compra', to: '/purchase-orders', icon: ShoppingCart, roles: ['seller', 'admin'] },
  { label: 'Informes', to: '/reports', icon: BarChart2, roles: ['seller', 'admin'] },
  { label: 'Usuarios', to: '/users', icon: Users, roles: ['admin'] },
  { label: 'Configuración', to: '/settings', icon: Settings, roles: ['admin'] },
];

const Sidebar = () => {
  const { user, logout } = useAuthStore();

  // Aviso de trial por vencer (solo admin, ≤7 días)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  // Aviso de plan pago por vencer/vencido (solo admin, ≤7 días) — mismo trato
  // visual que el trial, ahora también visible dentro de la plataforma (antes
  // solo llegaba por push/email, sin nada que lo mostrara en pantalla). Un
  // tenant realmente suspendido por no pago no llega a ver esto — el login
  // y tenantScope ya lo bloquean antes; esto cubre la ventana en que todavía
  // puede entrar (por vencer, o vencido y en gracia).
  const [renewalDaysLeft, setRenewalDaysLeft] = useState<number | null>(null);
  useEffect(() => {
    if (user?.role !== 'admin' || !navigator.onLine) return;
    getMyTenant().then(t => {
      if (!t) return;
      if (t.plan === 'trial') {
        if (t.trialEndsAt) {
          const days = Math.ceil((new Date(t.trialEndsAt).getTime() - Date.now()) / 86400000);
          if (days <= 7) setTrialDaysLeft(days);
        }
        return;
      }
      // paidUntil null = fuera del ciclo (cortesía/legado) — sin aviso
      if (t.paidUntil) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(`${t.paidUntil}T00:00:00`);
        const days = Math.round((due.getTime() - today.getTime()) / 86400000);
        if (days <= 7) setRenewalDaysLeft(days);
      }
    }).catch(() => {/* silencioso */});
  }, [user?.role]);
  const { tenant } = useTenantStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => user?.role && item.roles.includes(user.role) && (!item.feature || tenant?.features?.includes(item.feature))
  );

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full w-56 bg-white border-r border-gray-200 z-40">
      {/* Logo */}
      <div className="flex items-center space-x-2.5 px-5 py-5 border-b border-gray-100">
        <div className="p-1.5 rounded-xl bg-primary/10">
          {tenant?.logoUrl
            ? <img src={tenant.logoUrl} alt={tenant.name} className="w-6 h-6 object-contain" />
            : <Package className="w-6 h-6 text-primary" />}
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">{tenant?.name ?? 'Merco'}</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Navegación principal">
        {visibleItems.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                active
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon
                className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`}
              />
              <span>{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Trial por vencer */}
      {trialDaysLeft !== null && (
        <Link
          to="/settings"
          className="mx-3 mb-2 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-amber-800 leading-snug">
            {trialDaysLeft <= 0
              ? 'Tu período de prueba vence HOY'
              : trialDaysLeft === 1
                ? 'Tu prueba vence mañana'
                : `Tu prueba vence en ${trialDaysLeft} días`}
            <span className="block text-amber-600 font-medium mt-0.5">Activa un plan →</span>
          </span>
        </Link>
      )}

      {/* Plan pago por vencer / vencido */}
      {renewalDaysLeft !== null && (
        <Link
          to="/settings"
          className={`mx-3 mb-2 flex items-start gap-2 px-3 py-2.5 rounded-xl transition-colors ${
            renewalDaysLeft < 0
              ? 'bg-red-50 border border-red-200 hover:bg-red-100'
              : 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${renewalDaysLeft < 0 ? 'text-red-600' : 'text-amber-600'}`} />
          <span className={`text-xs leading-snug ${renewalDaysLeft < 0 ? 'text-red-800' : 'text-amber-800'}`}>
            {renewalDaysLeft < 0
              ? `Tu plan venció hace ${-renewalDaysLeft} día${renewalDaysLeft === -1 ? '' : 's'}`
              : renewalDaysLeft === 0
                ? 'Tu plan vence HOY'
                : renewalDaysLeft === 1
                  ? 'Tu plan vence mañana'
                  : `Tu plan vence en ${renewalDaysLeft} días`}
            <span className={`block font-medium mt-0.5 ${renewalDaysLeft < 0 ? 'text-red-600' : 'text-amber-600'}`}>
              {renewalDaysLeft < 0 ? 'Reporta tu pago →' : 'Renueva tu plan →'}
            </span>
          </span>
        </Link>
      )}

      {/* User section */}
      {user && (
        <div className="border-t border-gray-100 px-3 py-4">
          <div className="flex items-center space-x-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary/70 to-primary rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.name || user.username}</p>
              <p className="text-xs text-gray-400 capitalize flex items-center space-x-1">
                <Shield className="w-3 h-3 flex-shrink-0" />
                <span>{user.role}</span>
              </p>
            </div>
          </div>
          <Link
            to="/profile"
            className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors duration-150"
          >
            <User className="w-5 h-5 flex-shrink-0" />
            <span>Mi perfil</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-150"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
