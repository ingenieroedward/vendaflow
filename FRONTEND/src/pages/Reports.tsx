import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../database/LocalDatabase';
import { useAuthStore } from '../store/authStore';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, subMonths, startOfDay, startOfMonth, startOfYear, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, ShoppingCart, DollarSign, Users, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

type Period = 'daily' | 'monthly' | 'annual';

interface OrderRow {
  totalAmount: number;
  createdAt: string;
  userId: number;
  customerId: number;
  status: string;
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

const formatCOPShort = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

const Reports: React.FC = () => {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<Period>('monthly');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const all = await db.orders
        .filter(o => !o.deletedAt && o.status !== 'cancelled')
        .toArray();
      setOrders(all.map(o => ({
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        userId: o.userId,
        customerId: o.customerId,
        status: o.status,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  // ── Generar datos del gráfico ────────────────────────────────────────────
  const chartData = useMemo(() => {
    const now = new Date();

    if (period === 'daily') {
      // Últimos 30 días
      return Array.from({ length: 30 }, (_, i) => {
        const day = subDays(now, 29 - i);
        const start = startOfDay(day).toISOString();
        const end = endOfDay(day).toISOString();
        const dayOrders = orders.filter(o => o.createdAt >= start && o.createdAt <= end);
        return {
          label: format(day, 'dd/MM', { locale: es }),
          ventas: dayOrders.reduce((s, o) => s + o.totalAmount, 0),
          ordenes: dayOrders.length,
        };
      });
    }

    if (period === 'monthly') {
      // Últimos 12 meses
      return Array.from({ length: 12 }, (_, i) => {
        const month = subMonths(now, 11 - i);
        const start = startOfMonth(month).toISOString();
        const end = startOfMonth(subMonths(month, -1)).toISOString();
        const monthOrders = orders.filter(o => o.createdAt >= start && o.createdAt < end);
        return {
          label: format(month, 'MMM yy', { locale: es }),
          ventas: monthOrders.reduce((s, o) => s + o.totalAmount, 0),
          ordenes: monthOrders.length,
        };
      });
    }

    // Annual — últimos 5 años
    return Array.from({ length: 5 }, (_, i) => {
      const year = now.getFullYear() - 4 + i;
      const start = startOfYear(new Date(year, 0, 1)).toISOString();
      const end = startOfYear(new Date(year + 1, 0, 1)).toISOString();
      const yearOrders = orders.filter(o => o.createdAt >= start && o.createdAt < end);
      return {
        label: String(year),
        ventas: yearOrders.reduce((s, o) => s + o.totalAmount, 0),
        ordenes: yearOrders.length,
      };
    });
  }, [orders, period]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const monthStart = startOfMonth(now).toISOString();
    const yearStart = startOfYear(now).toISOString();

    const total = (from: string) =>
      orders.filter(o => o.createdAt >= from).reduce((s, o) => s + o.totalAmount, 0);
    const count = (from: string) =>
      orders.filter(o => o.createdAt >= from).length;
    const customers = (from: string) =>
      new Set(orders.filter(o => o.createdAt >= from).map(o => o.customerId)).size;

    return {
      today: { ventas: total(todayStart), ordenes: count(todayStart) },
      month: { ventas: total(monthStart), ordenes: count(monthStart), clientes: customers(monthStart) },
      year:  { ventas: total(yearStart),  ordenes: count(yearStart) },
      total: { ventas: orders.reduce((s, o) => s + o.totalAmount, 0), ordenes: orders.length },
    };
  }, [orders]);

  const periods: { key: Period; label: string }[] = [
    { key: 'daily',   label: '30 días' },
    { key: 'monthly', label: '12 meses' },
    { key: 'annual',  label: '5 años' },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="text-center mb-4">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1">Informes de Ventas</h1>
            <p className="text-sm text-gray-500">Basado en órdenes locales sincronizadas</p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={loadOrders}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-gray-500 font-medium">Hoy</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{formatCOPShort(kpis.today.ventas)}</p>
                <p className="text-xs text-gray-400">{kpis.today.ordenes} órdenes</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-gray-500 font-medium">Este mes</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{formatCOPShort(kpis.month.ventas)}</p>
                <p className="text-xs text-gray-400">{kpis.month.ordenes} órdenes · {kpis.month.clientes} clientes</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-gray-500 font-medium">Este año</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{formatCOPShort(kpis.year.ventas)}</p>
                <p className="text-xs text-gray-400">{kpis.year.ordenes} órdenes</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-gray-500 font-medium">Total</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{formatCOPShort(kpis.total.ventas)}</p>
                <p className="text-xs text-gray-400">{kpis.total.ordenes} órdenes</p>
              </div>
            </div>

            {/* Period selector */}
            <div className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-xl p-1 w-fit">
              {periods.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    period === p.key
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Gráfico de ventas */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Ventas ({periods.find(p => p.key === period)?.label})</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={formatCOPShort} tick={{ fontSize: 10 }} width={55} />
                  <Tooltip
                    formatter={(v: number) => [formatCOP(v), 'Ventas']}
                    labelStyle={{ fontSize: 11 }}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Bar dataKey="ventas" fill="#111827" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de órdenes */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Número de órdenes ({periods.find(p => p.key === period)?.label})</h2>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={30} />
                  <Tooltip
                    formatter={(v: number) => [v, 'Órdenes']}
                    labelStyle={{ fontSize: 11 }}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Line dataKey="ordenes" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Nota */}
            <p className="text-xs text-gray-400 mt-3 text-center">
              Solo se muestran órdenes sincronizadas localmente (excluye canceladas).
              {user?.role === 'seller' ? ' Incluye todas las órdenes del sistema.' : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
