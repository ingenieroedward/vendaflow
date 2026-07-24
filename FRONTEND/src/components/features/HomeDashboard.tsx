import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, TrendingUp, AlertTriangle, Package, ChevronRight } from 'lucide-react';
import { getHomeStats, HomeStats } from '../../services/orders';
import { productService } from '../../services/products';
import { formatCurrency } from '../../utils/helpers';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'En proceso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

interface Props {
  totalProducts: number;
}

// KPIs reales + actividad reciente para el Home del admin.
// Requiere red — si falla u offline, no se muestra (el Home sigue funcionando).
const HomeDashboard: React.FC<Props> = ({ totalProducts }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [lowStock, setLowStock] = useState<number | null>(null);

  useEffect(() => {
    if (!navigator.onLine) return;
    getHomeStats().then(setStats).catch(() => setStats(null));
    productService.getStockAlerts().then(p => setLowStock(p.length)).catch(() => setLowStock(null));
  }, []);

  if (!stats) return null;

  const kpis = [
    {
      label: 'Órdenes pendientes',
      value: String(stats.pendingOrders),
      sub: stats.pendingOrders > 0 ? 'por atender' : 'todo al día',
      icon: ClipboardList,
      iconBg: stats.pendingOrders > 0 ? 'bg-amber-100' : 'bg-gray-100',
      iconCls: stats.pendingOrders > 0 ? 'text-amber-600' : 'text-gray-400',
      accent: stats.pendingOrders > 0 ? 'text-amber-600' : 'text-gray-900',
      onClick: () => navigate('/orders'),
    },
    {
      label: 'Ventas del mes',
      value: formatCurrency(stats.salesThisMonth),
      sub: `${stats.ordersThisMonth} ${stats.ordersThisMonth === 1 ? 'orden' : 'órdenes'} este mes`,
      icon: TrendingUp,
      iconBg: 'bg-green-100',
      iconCls: 'text-green-600',
      accent: 'text-gray-900',
      onClick: () => navigate('/reports'),
    },
    {
      label: 'Stock bajo',
      value: lowStock !== null ? String(lowStock) : '—',
      sub: lowStock ? 'productos por reponer' : 'todo en orden',
      icon: AlertTriangle,
      iconBg: lowStock ? 'bg-red-100' : 'bg-gray-100',
      iconCls: lowStock ? 'text-red-500' : 'text-gray-400',
      accent: lowStock ? 'text-red-600' : 'text-gray-900',
      onClick: () => navigate('/inventory'),
    },
    {
      label: 'Productos',
      value: String(totalProducts),
      sub: 'en catálogo',
      icon: Package,
      iconBg: 'bg-blue-100',
      iconCls: 'text-blue-600',
      accent: 'text-gray-900',
      onClick: undefined,
    },
  ];

  return (
    <div className="mb-6 sm:mb-8 space-y-4 sm:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map(k => (
          <button
            key={k.label}
            onClick={k.onClick}
            disabled={!k.onClick}
            className={`group bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 text-left ${
              k.onClick ? 'hover:border-blue-300 hover:shadow-md transition-all cursor-pointer' : 'cursor-default'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${k.iconBg}`}>
                <k.icon className={`w-5 h-5 ${k.iconCls}`} />
              </div>
              {k.onClick && (
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all mt-1" />
              )}
            </div>
            <p className={`text-2xl font-bold leading-none truncate ${k.accent}`}>{k.value}</p>
            <p className="text-xs font-medium text-gray-500 mt-1.5">{k.label}</p>
            {k.sub && <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>}
          </button>
        ))}
      </div>

      {/* Actividad reciente */}
      {stats.recentOrders.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Actividad reciente</h3>
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800"
            >
              Ver todas <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {stats.recentOrders.map(o => (
              <li key={o.id}>
                <button
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {o.orderNumber}
                      {o.customer && <span className="text-gray-500 font-normal"> · {o.customer.name}</span>}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(o.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                      {formatCurrency(o.totalAmount)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HomeDashboard;
