import { useState } from 'react';
import { Package, ClipboardList, Users, DollarSign, Truck, Tag, UserCheck, BarChart2, Warehouse, ShoppingCart, MoreHorizontal, X, Settings, Store } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useFeature } from '../../hooks/useFeature';

interface NavItem {
  label: string;
  to: string;
  icon: React.FC<{ className?: string }>;
  roles: string[];
  feature?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Productos',   to: '/',                icon: Package,       roles: ['buyer', 'seller', 'admin'] },
  { label: 'Clientes',    to: '/customers',       icon: UserCheck,     roles: ['seller', 'admin'] },
  { label: 'Órdenes',     to: '/orders',          icon: ClipboardList, roles: ['seller', 'admin'] },
  { label: 'Punto de venta', to: '/pos',          icon: Store,         roles: ['seller', 'admin'], feature: 'pos' },
  { label: 'Inventario',  to: '/inventory',       icon: Warehouse,     roles: ['seller', 'admin'] },
  { label: 'Precios',     to: '/prices',          icon: DollarSign,    roles: ['buyer', 'admin'] },
  { label: 'Proveedores', to: '/suppliers',       icon: Truck,         roles: ['buyer', 'admin'] },
  { label: 'Categorías',  to: '/categories',      icon: Tag,           roles: ['buyer', 'admin'] },
  { label: 'Compras',     to: '/purchase-orders', icon: ShoppingCart,  roles: ['seller', 'admin'] },
  { label: 'Informes',    to: '/reports',         icon: BarChart2,     roles: ['seller', 'admin'] },
  { label: 'Usuarios',        to: '/users',    icon: Users,    roles: ['admin'] },
  { label: 'Configuración',   to: '/settings', icon: Settings, roles: ['admin'] },
];

// Max items shown directly in the bar before overflow into "Más"
const MAX_VISIBLE = 5;

const BottomNav = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const hasPos = useFeature('pos');
  const allItems = NAV_ITEMS.filter(
    (item) => user?.role && item.roles.includes(user.role) && (item.feature !== 'pos' || hasPos)
  );

  const visibleItems = allItems.length > MAX_VISIBLE ? allItems.slice(0, MAX_VISIBLE - 1) : allItems;
  const overflowItems = allItems.length > MAX_VISIBLE ? allItems.slice(MAX_VISIBLE - 1) : [];
  const hasOverflow = overflowItems.length > 0;

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  const overflowActive = overflowItems.some(item => isActive(item.to));

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegación inferior"
      >
        <div className="flex items-stretch h-16">
          {visibleItems.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-1 flex flex-col items-center justify-center space-y-0.5 text-xs font-medium transition-colors duration-150 relative ${
                  active ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`} />
                <span className="leading-none">{item.label}</span>
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" aria-hidden="true" />
                )}
              </Link>
            );
          })}

          {hasOverflow && (
            <button
              onClick={() => setShowMore(v => !v)}
              className={`flex-1 flex flex-col items-center justify-center space-y-0.5 text-xs font-medium transition-colors duration-150 relative ${
                overflowActive || showMore ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label="Más opciones"
            >
              <MoreHorizontal className={`w-5 h-5 ${overflowActive || showMore ? 'text-primary' : 'text-gray-400'}`} />
              <span className="leading-none">Más</span>
              {overflowActive && !showMore && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </nav>

      {/* Overflow sheet */}
      {showMore && hasOverflow && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-50"
            onClick={() => setShowMore(false)}
          />
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Más opciones</span>
              <button
                onClick={() => setShowMore(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 p-4">
              {overflowItems.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl text-xs font-medium transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className={`w-6 h-6 ${active ? 'text-primary' : 'text-gray-500'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default BottomNav;
