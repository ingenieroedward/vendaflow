import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { db } from '../database/LocalDatabase';
import { orderService } from '../services/orders';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  format, subDays, subMonths, startOfDay, startOfMonth,
  startOfYear, endOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  TrendingUp, ShoppingCart, DollarSign, Users, RefreshCw,
  WifiOff, Package,
} from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

type Period = 'daily' | 'monthly' | 'annual';

interface OrderRow {
  totalAmount: number;
  createdAt: string;
  customerId: number;
  status: string;
}

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

const COPShort = (n: number) => {
  if (n === 0) return '$0';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

// Custom tooltip for bar/line charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name === 'ventas' ? COP(p.value) : `${p.value} órdenes`}
        </p>
      ))}
    </div>
  );
};

const Reports: React.FC = () => {
  const [period, setPeriod] = useState<Period>('monthly');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setIsOffline(!navigator.onLine);
    try {
      if (navigator.onLine) {
        // Online: fetch from server (all orders, up to 2000)
        const response = await orderService.getOrders(1, 2000);
        setOrders(
          (response.data ?? [])
            .filter((o: any) => o.status !== 'cancelled')
            .map((o: any) => ({
              totalAmount: Number(o.totalAmount),
              createdAt: o.createdAt,
              customerId: o.customerId,
              status: o.status,
            }))
        );
      } else {
        // Offline: use local Dexie
        const all = await db.orders
          .filter(o => !o.deletedAt && o.status !== 'cancelled')
          .toArray();
        setOrders(all.map(o => ({
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
          customerId: o.customerId,
          status: o.status,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // ── Chart data ───────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const now = new Date();

    if (period === 'daily') {
      return Array.from({ length: 30 }, (_, i) => {
        const day = subDays(now, 29 - i);
        const start = startOfDay(day).toISOString();
        const end = endOfDay(day).toISOString();
        const slice = orders.filter(o => o.createdAt >= start && o.createdAt <= end);
        return {
          label: format(day, 'dd/MM', { locale: es }),
          ventas: slice.reduce((s, o) => s + o.totalAmount, 0),
          ordenes: slice.length,
        };
      });
    }

    if (period === 'monthly') {
      return Array.from({ length: 12 }, (_, i) => {
        const month = subMonths(now, 11 - i);
        const start = startOfMonth(month).toISOString();
        const end = startOfMonth(subMonths(month, -1)).toISOString();
        const slice = orders.filter(o => o.createdAt >= start && o.createdAt < end);
        return {
          label: format(month, 'MMM yy', { locale: es }),
          ventas: slice.reduce((s, o) => s + o.totalAmount, 0),
          ordenes: slice.length,
        };
      });
    }

    return Array.from({ length: 5 }, (_, i) => {
      const year = now.getFullYear() - 4 + i;
      const start = startOfYear(new Date(year, 0, 1)).toISOString();
      const end = startOfYear(new Date(year + 1, 0, 1)).toISOString();
      const slice = orders.filter(o => o.createdAt >= start && o.createdAt < end);
      return {
        label: String(year),
        ventas: slice.reduce((s, o) => s + o.totalAmount, 0),
        ordenes: slice.length,
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
      today:  { ventas: total(todayStart),  ordenes: count(todayStart) },
      month:  { ventas: total(monthStart),  ordenes: count(monthStart), clientes: customers(monthStart) },
      year:   { ventas: total(yearStart),   ordenes: count(yearStart) },
      all:    { ventas: total(''),          ordenes: count('') },
    };
  }, [orders]);

  // ── Top period for bar chart max ──────────────────────────────────────────
  const maxVentas = useMemo(() => Math.max(...chartData.map(d => d.ventas), 1), [chartData]);
  const hasData   = orders.length > 0;

  const periods: { key: Period; label: string }[] = [
    { key: 'daily',   label: '30 días'   },
    { key: 'monthly', label: '12 meses'  },
    { key: 'annual',  label: '5 años'    },
  ];

  const periodLabel = periods.find(p => p.key === period)?.label ?? '';

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Informes de Ventas</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {isOffline ? 'Datos locales (sin conexión)' : 'Datos en tiempo real del servidor'}
            </p>
          </div>
          <button
            onClick={loadOrders}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* Offline banner */}
        {isOffline && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
            Sin conexión — mostrando datos guardados localmente.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { icon: TrendingUp,  color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Hoy',       ventas: kpis.today.ventas,  sub: `${kpis.today.ordenes} órden${kpis.today.ordenes !== 1 ? 'es' : ''}` },
                { icon: ShoppingCart,color: 'text-blue-500',    bg: 'bg-blue-50',    label: 'Este mes',   ventas: kpis.month.ventas,  sub: `${kpis.month.ordenes} órd · ${kpis.month.clientes} clientes` },
                { icon: DollarSign,  color: 'text-violet-500',  bg: 'bg-violet-50',  label: 'Este año',   ventas: kpis.year.ventas,   sub: `${kpis.year.ordenes} órdenes` },
                { icon: Package,     color: 'text-orange-500',  bg: 'bg-orange-50',  label: 'Total',      ventas: kpis.all.ventas,    sub: `${kpis.all.ordenes} órdenes` },
              ].map(({ icon: Icon, color, bg, label, ventas, sub }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <span className="text-xs font-medium text-gray-500">{label}</span>
                  </div>
                  <p className={`text-lg font-bold ${ventas > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                    {COPShort(ventas)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Period selector */}
            <div className="flex gap-1 mb-5 bg-white border border-gray-100 rounded-xl p-1 w-fit shadow-sm">
              {periods.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    period === p.key
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {!hasData ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">Sin datos de ventas</p>
                <p className="text-gray-300 text-sm mt-1">Crea órdenes para ver los informes</p>
              </div>
            ) : (
              <>
                {/* Bar chart — ventas */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">Ventas</h2>
                    <span className="text-xs text-gray-400">{periodLabel}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={COPShort}
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                        domain={[0, maxVentas * 1.15]}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                      <Bar dataKey="ventas" name="ventas" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.ventas > 0 ? '#111827' : '#e5e7eb'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Line chart — órdenes */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">Número de órdenes</h2>
                    <span className="text-xs text-gray-400">{periodLabel}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                      />
                      <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                      <Line
                        dataKey="ordenes"
                        name="ordenes"
                        stroke="#111827"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#111827', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#111827' }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            <p className="text-xs text-gray-300 mt-4 text-center">
              {orders.length} órdenes · Excluye canceladas
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
