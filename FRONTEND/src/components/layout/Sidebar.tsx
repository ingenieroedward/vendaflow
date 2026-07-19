import { Package, ClipboardList, Users, LogOut, User, Shield, Truck, Tag, DollarSign, UserCheck, BarChart2, Warehouse, ShoppingCart } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useTenantStore } from '../../store/tenantStore';

interface NavItem {
  label: string;
  to: string;
  icon: React.FC<{ className?: string }>;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Productos', to: '/', icon: Package, roles: ['buyer', 'seller', 'admin'] },
  { label: 'Precios', to: '/prices', icon: DollarSign, roles: ['buyer', 'admin'] },
  { label: 'Proveedores', to: '/suppliers', icon: Truck, roles: ['buyer', 'admin'] },
  { label: 'Categorías', to: '/categories', icon: Tag, roles: ['buyer', 'admin'] },
  { label: 'Clientes', to: '/customers', icon: UserCheck, roles: ['seller', 'admin'] },
  { label: 'Órdenes', to: '/orders', icon: ClipboardList, roles: ['seller', 'admin'] },
  { label: 'Inventario', to: '/inventory', icon: Warehouse, roles: ['seller', 'admin'] },
  { label: 'Órdenes Compra', to: '/purchase-orders', icon: ShoppingCart, roles: ['seller', 'admin'] },
  { label: 'Informes', to: '/reports', icon: BarChart2, roles: ['seller', 'admin'] },
  { label: 'Usuarios', to: '/users', icon: Users, roles: ['admin'] },
];

const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const { tenant } = useTenantStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => user?.role && item.roles.includes(user.role)
  );

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full w-56 bg-white border-r border-gray-200 z-40">
      {/* Logo */}
      <div className="flex items-center space-x-2.5 px-5 py-5 border-b border-gray-100">
        <div className="p-1.5 rounded-xl bg-blue-50">
          {tenant?.logoUrl
            ? <img src={tenant.logoUrl} alt={tenant.name} className="w-6 h-6 object-contain" />
            : <Package className="w-6 h-6 text-blue-600" />}
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">{tenant?.name ?? 'VendaFlow'}</span>
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
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon
                className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}
              />
              <span>{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      {user && (
        <div className="border-t border-gray-100 px-3 py-4">
          <div className="flex items-center space-x-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.username}</p>
              <p className="text-xs text-gray-400 capitalize flex items-center space-x-1">
                <Shield className="w-3 h-3 flex-shrink-0" />
                <span>{user.role}</span>
              </p>
            </div>
          </div>
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
