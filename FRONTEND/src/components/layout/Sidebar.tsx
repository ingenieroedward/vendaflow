import { Plus, Package, ClipboardList, Users, LogOut, User, Shield, Truck, Tag, DollarSign, UserCheck, BarChart2, Warehouse, ShoppingCart, Settings, AlertTriangle, Store, FileText, CreditCard } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useTenantStore } from '../../store/tenantStore';
import { useTenantRenewalStatus } from '../../hooks/useTenantRenewalStatus';
import { roleLabel } from '../../utils/roles';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useOrderStore } from '../../store/orderStore';
import { useQuoteStore } from '../../store/quoteStore';

interface NavItem {
  label: string;
  to: string;
  icon: React.FC<{ className?: string }>;
  roles: string[];
  feature?: string; // si se define, solo se muestra si el tenant tiene esa feature del plan
}

// Agrupado por tarea (antes 14 enlaces planos): lo de vender primero, para
// que el vendedor no busque el POS entre Proveedores y Categorías
type NavGroup = 'Vender' | 'Catálogo' | 'Negocio';
const NAV_GROUPS: NavGroup[] = ['Vender', 'Catálogo', 'Negocio'];

const NAV_ITEMS: (NavItem & { group: NavGroup })[] = [
  { label: 'Punto de venta', to: '/pos', icon: Store, roles: ['seller', 'admin'], feature: 'pos', group: 'Vender' },
  { label: 'Órdenes', to: '/orders', icon: ClipboardList, roles: ['seller', 'admin'], group: 'Vender' },
  { label: 'Cotizaciones', to: '/quotes', icon: FileText, roles: ['seller', 'admin'], feature: 'quotes', group: 'Vender' },
  { label: 'Clientes', to: '/customers', icon: UserCheck, roles: ['seller', 'admin'], group: 'Vender' },
  { label: 'Productos', to: '/', icon: Package, roles: ['buyer', 'seller', 'admin'], group: 'Catálogo' },
  { label: 'Inventario', to: '/inventory', icon: Warehouse, roles: ['seller', 'admin'], group: 'Catálogo' },
  { label: 'Precios', to: '/prices', icon: DollarSign, roles: ['buyer', 'admin'], group: 'Catálogo' },
  { label: 'Proveedores', to: '/suppliers', icon: Truck, roles: ['buyer', 'admin'], group: 'Catálogo' },
  { label: 'Categorías', to: '/categories', icon: Tag, roles: ['buyer', 'admin'], group: 'Catálogo' },
  { label: 'Órdenes de compra', to: '/purchase-orders', icon: ShoppingCart, roles: ['seller', 'admin'], group: 'Catálogo' },
  { label: 'Informes', to: '/reports', icon: BarChart2, roles: ['seller', 'admin'], group: 'Negocio' },
  { label: 'Usuarios', to: '/users', icon: Users, roles: ['admin'], group: 'Negocio' },
  { label: 'Facturación', to: '/billing', icon: CreditCard, roles: ['admin'], group: 'Negocio' },
  { label: 'Configuración', to: '/settings', icon: Settings, roles: ['admin'], group: 'Negocio' },
];

const Sidebar = () => {
  const { user, logout } = useAuthStore();

  // Aviso de trial/plan pago por vencer o vencido (solo admin, ≤7 días) —
  // mismo hook que usa Header.tsx para el aviso equivalente en mobile.
  const { trialDaysLeft, renewalDaysLeft } = useTenantRenewalStatus();
  const { tenant } = useTenantStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const { isOffline } = useNetworkStatus();
  const pendingOrders = useOrderStore((st) => st.pendingSync);
  const pendingQuotes = useQuoteStore((st) => st.pendingSync);
  const pending = (pendingOrders ?? 0) + (pendingQuotes ?? 0);
  const canSell = user?.role === 'seller' || user?.role === 'admin';
  const hasPos = !!tenant?.features?.includes('pos');

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
        <div className="min-w-0">
          <span className="block text-lg font-bold text-gray-900 tracking-tight truncate">{tenant?.name ?? 'Merco'}</span>
          {/* Estado de sincronización siempre visible (offline-first) */}
          <Link
            to="/orders"
            className={`flex items-center gap-1.5 text-xs ${isOffline || pending > 0 ? 'text-amber-900' : 'text-gray-600'} hover:underline`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isOffline ? 'bg-gray-500' : pending > 0 ? 'bg-amber-500' : 'bg-green-600'}`}
              aria-hidden="true"
            />
            {isOffline
              ? 'Sin conexión'
              : pending > 0
                ? `${pending} sin enviar`
                : 'Sincronizado'}
          </Link>
        </div>
      </div>

      {/* Atajos a lo que más se hace: vender y crear orden */}
      {canSell && (
        <div className="grid grid-cols-2 gap-2 px-3 pt-3">
          {hasPos ? (
            <Link
              to="/pos"
              className="flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              <Store className="w-4 h-4" aria-hidden="true" /> Vender
            </Link>
          ) : null}
          <Link
            to="/orders/new"
            className={`flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${hasPos ? '' : 'col-span-2'}`}
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> Orden
          </Link>
        </div>
      )}

      {/* Nav links */}
      {/* min-h-0 + overflow: en pantallas bajas (768px) con avisos de plan,
          antes la sección de usuario quedaba cortada */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-3" aria-label="Navegación principal">
        {NAV_GROUPS.map((group) => {
          const items = visibleItems.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-3 last:mb-0">
              <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{group}</p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        active
                          ? 'bg-primary/10 text-gray-900 font-semibold'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon
                        className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary' : 'text-gray-500'}`}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Trial por vencer */}
      {trialDaysLeft !== null && (
        <Link
          to="/billing"
          className="mx-3 mb-2 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-amber-800 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-amber-800 leading-snug">
            {trialDaysLeft <= 0
              ? 'Tu período de prueba vence HOY'
              : trialDaysLeft === 1
                ? 'Tu prueba vence mañana'
                : `Tu prueba vence en ${trialDaysLeft} días`}
            <span className="block text-amber-800 font-medium mt-0.5">Activa un plan →</span>
          </span>
        </Link>
      )}

      {/* Plan pago por vencer / vencido */}
      {renewalDaysLeft !== null && (
        <Link
          to="/billing"
          className={`mx-3 mb-2 flex items-start gap-2 px-3 py-2.5 rounded-xl transition-colors ${
            renewalDaysLeft < 0
              ? 'bg-red-50 border border-red-200 hover:bg-red-100'
              : 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${renewalDaysLeft < 0 ? 'text-red-600' : 'text-amber-800'}`} />
          <span className={`text-xs leading-snug ${renewalDaysLeft < 0 ? 'text-red-800' : 'text-amber-800'}`}>
            {renewalDaysLeft < 0
              ? `Tu plan venció hace ${-renewalDaysLeft} día${renewalDaysLeft === -1 ? '' : 's'}`
              : renewalDaysLeft === 0
                ? 'Tu plan vence HOY'
                : renewalDaysLeft === 1
                  ? 'Tu plan vence mañana'
                  : `Tu plan vence en ${renewalDaysLeft} días`}
            <span className={`block font-medium mt-0.5 ${renewalDaysLeft < 0 ? 'text-red-600' : 'text-amber-800'}`}>
              {renewalDaysLeft < 0 ? 'Reporta tu pago →' : 'Renueva tu plan →'}
            </span>
          </span>
        </Link>
      )}

      {/* User section */}
      {user && (
        <div className="border-t border-gray-100 px-3 py-4">
          <div className="flex items-center space-x-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
              <User className="w-4 h-4 text-on-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.name || user.username}</p>
              <p className="text-xs text-gray-600 flex items-center space-x-1">
                <Shield className="w-3 h-3 flex-shrink-0" />
                <span>{roleLabel(user.role)}</span>
              </p>
            </div>
          </div>
          <Link
            to="/profile"
            className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-150"
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
