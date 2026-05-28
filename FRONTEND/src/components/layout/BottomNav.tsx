import { Package, ClipboardList, Users, DollarSign, Truck, Tag, UserCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  label: string;
  to: string;
  icon: React.FC<{ className?: string }>;
  roles: string[];
}

// buyer: Products, Prices, Suppliers, Categories (4)
// seller: Products, Orders (2)
// admin: Products, Prices, Orders, Users (4) — Suppliers/Categories via sidebar on desktop
const NAV_ITEMS: NavItem[] = [
  { label: 'Productos', to: '/', icon: Package, roles: ['buyer', 'seller', 'admin'] },
  { label: 'Precios', to: '/prices', icon: DollarSign, roles: ['buyer', 'admin'] },
  { label: 'Proveedores', to: '/suppliers', icon: Truck, roles: ['buyer'] },
  { label: 'Categorías', to: '/categories', icon: Tag, roles: ['buyer'] },
  { label: 'Clientes', to: '/customers', icon: UserCheck, roles: ['seller', 'admin'] },
  { label: 'Órdenes', to: '/orders', icon: ClipboardList, roles: ['seller', 'admin'] },
  { label: 'Usuarios', to: '/users', icon: Users, roles: ['admin'] },
];

const BottomNav = () => {
  const { user } = useAuthStore();
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter(
    (item) => user?.role && item.roles.includes(user.role)
  );

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
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
              className={`flex-1 flex flex-col items-center justify-center space-y-1 text-xs font-medium transition-colors duration-150 ${
                active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon
                className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}
              />
              <span>{item.label}</span>
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
