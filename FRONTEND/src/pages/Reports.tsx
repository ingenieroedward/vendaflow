import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { db } from '../database/LocalDatabase';
import { orderService } from '../services/orders';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  format, subDays, subMonths, subYears, startOfDay, startOfMonth,
  startOfYear, endOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  TrendingUp, ShoppingCart, DollarSign, RefreshCw,
  WifiOff, Package, Users,
} from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

type Period = 'daily' | 'monthly' | 'annual';

interface OrderRow {
  totalAmount: number;
  createdAt: string;
  customerId: number;
  customerName: string;
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name === 'ventas' ? COP(p.value) : `${p.value} órden${p.value !== 1 ? 'es' : ''}`}
        </p>
      ))}
    </div>
  );
};

// Blue palette: empty → light gray, low → blue-300, high → blue-700
const barColor = (value: number, max: number) => {
  if (value === 0 || max === 0) return '#e5e7eb';
  const t = value / max;
  // interpolate from #93c5fd (blue-300) to #1d4ed8 (blue-700)
  const r = Math.round(147 + (29 - 147) * t);
  const g = Math.round(197 + (78 - 197) * t);
  const b = Math.round(253 + (216 - 253) * t);
  return `rgb(${r},${g},${b})`;
};

const Reports: React.FC = () => {
  const [period, setPeriod] = useState<Period>('daily');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setIsOffline(!navigator.onLine);
    try {
      if (navigator.onLine) {
        const response = await orderService.getOrders(1, 2000);
        setOrders(
          (response.data ?? [])
            .filter((o: any) => o.status !== 'cancelled')
            .map((o: any) => ({
              totalAmount: Number(o.totalAmount),
              createdAt: o.createdAt,
              customerId: o.customerId,
              customerName: o.customer?.name ?? `Cliente #${o.customerId}`,
              status: o.status,
            }))
        );
      } else {
        const all = await db.orders
          .filter(o => !o.deletedAt && o.status !== 'cancelled')
          .toArray();
        setOrders(all.map(o => ({
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
          customerId: o.customerId,
          customerName: `Cliente #${o.customerId}`,
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
    const todayStart   = startOfDay(now).toISOString();
    const monthStart   = startOfMonth(now).toISOString();
    const prevMonthStart = startOfMonth(subMonths(now, 1)).toISOString();

    const sum = (from: string, to?: string) =>
      orders.filter(o => o.createdAt >= from && (!to || o.createdAt < to))
            .reduce((s, o) => s + o.totalAmount, 0);
    const cnt = (from: string, to?: string) =>
      orders.filter(o => o.createdAt >= from && (!to || o.createdAt < to)).length;

    const monthVentas    = sum(monthStart);
    const prevMonthVentas = sum(prevMonthStart, monthStart);
    const monthPct = prevMonthVentas > 0
      ? Math.round(((monthVentas - prevMonthVentas) / prevMonthVentas) * 100)
      : null;

    const allVentas = sum('');
    const allCount  = cnt('');
    const avgTicket = allCount > 0 ? Math.round(allVentas / allCount) : 0;

    return {
      today:    { ventas: sum(todayStart), ordenes: cnt(todayStart) },
      month:    { ventas: monthVentas, ordenes: cnt(monthStart), clientes: new Set(orders.filter(o => o.createdAt >= monthStart).map(o => o.customerId)).size, pct: monthPct },
      avgTicket,
      all:      { ventas: allVentas, ordenes: allCount },
    };
  }, [orders]);

  // ── Period-scoped analytics ───────────────────────────────────────────────
  const periodOrders = useMemo(() => {
    const now = new Date();
    let from: Date;
    if (period === 'daily')   from = subDays(now, 29);
    else if (period === 'monthly') from = subMonths(now, 11);
    else from = subYears(now, 4);
    const fromIso = startOfDay(from).toISOString();
    return orders.filter(o => o.createdAt >= fromIso);
  }, [orders, period]);

  const topClients = useMemo(() => {
    const map = new Map<number, { name: string; ventas: number; ordenes: number }>();
    periodOrders.forEach(o => {
      const cur = map.get(o.customerId) ?? { name: o.customerName, ventas: 0, ordenes: 0 };
      map.set(o.customerId, { ...cur, ventas: cur.ventas + o.totalAmount, ordenes: cur.ordenes + 1 });
    });
    return [...map.values()].sort((a, b) => b.ventas - a.ventas).slice(0, 5);
  }, [periodOrders]);

  const statusDist = useMemo(() => {
    const total = periodOrders.length;
    if (total === 0) return null;
    const completed = periodOrders.filter(o => o.status === 'completed').length;
    const pending   = periodOrders.filter(o => o.status === 'pending').length;
    return {
      completed, pending, total,
      pctCompleted: Math.round((completed / total) * 100),
      pctPending:   Math.round((pending   / total) * 100),
    };
  }, [periodOrders]);

  const maxVentas  = useMemo(() => Math.max(...chartData.map(d => d.ventas), 1), [chartData]);
  const hasData    = orders.length > 0;

  const periods: { key: Period; label: string }[] = [
    { key: 'daily',   label: '30 días'  },
    { key: 'monthly', label: '12 meses' },
    { key: 'annual',  label: '5 años'   },
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
              {/* Hoy */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">Hoy</span>
                </div>
                <p className={`text-lg font-bold ${kpis.today.ventas > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                  {COPShort(kpis.today.ventas)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {kpis.today.ordenes} órden{kpis.today.ordenes !== 1 ? 'es' : ''}
                </p>
              </div>

              {/* Este mes + % variación */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">Este mes</span>
                </div>
                <div className="flex items-end gap-2">
                  <p className={`text-lg font-bold ${kpis.month.ventas > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                    {COPShort(kpis.month.ventas)}
                  </p>
                  {kpis.month.pct !== null && (
                    <span className={`mb-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none ${
                      kpis.month.pct >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                    }`}>
                      {kpis.month.pct >= 0 ? '+' : ''}{kpis.month.pct}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {kpis.month.ordenes} órd · {kpis.month.clientes} cliente{kpis.month.clientes !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Ticket promedio */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-violet-500" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">Ticket promedio</span>
                </div>
                <p className={`text-lg font-bold ${kpis.avgTicket > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                  {COPShort(kpis.avgTicket)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">por orden</p>
              </div>

              {/* Total */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
                    <Package className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">Total</span>
                </div>
                <p className={`text-lg font-bold ${kpis.all.ventas > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                  {COPShort(kpis.all.ventas)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{kpis.all.ordenes} órdenes</p>
              </div>
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
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-semibold text-gray-700">Ventas</h2>
                    <span className="text-xs text-gray-400">{periodLabel}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">
                    Total período: <span className="font-semibold text-gray-700">{COP(periodOrders.reduce((s, o) => s + o.totalAmount, 0))}</span>
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={COPShort} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={60} domain={[0, maxVentas * 1.15]} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                      <Bar dataKey="ventas" name="ventas" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={barColor(entry.ventas, maxVentas)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Line chart — órdenes */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-semibold text-gray-700">Número de órdenes</h2>
                    <span className="text-xs text-gray-400">{periodLabel}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">
                    Total período: <span className="font-semibold text-gray-700">{periodOrders.length} órden{periodOrders.length !== 1 ? 'es' : ''}</span>
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                      <Line
                        dataKey="ordenes"
                        name="ordenes"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#1d4ed8' }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Bottom row: Top clientes + Distribución estados */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

                  {/* Top clientes */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-gray-700">Top clientes</h2>
                      <span className="text-xs text-gray-400">{periodLabel}</span>
                    </div>
                    {topClients.length === 0 ? (
                      <p className="text-xs text-gray-300 text-center py-6">Sin datos en el período</p>
                    ) : (
                      <div className="space-y-3">
                        {topClients.map((c, i) => {
                          const pct = periodOrders.length > 0
                            ? Math.round((c.ventas / periodOrders.reduce((s, o) => s + o.totalAmount, 0)) * 100)
                            : 0;
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-bold text-gray-300 w-4 flex-shrink-0">#{i + 1}</span>
                                  <span className="text-xs font-medium text-gray-700 truncate">{c.name}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  <span className="text-xs text-gray-400">{c.ordenes} órd</span>
                                  <span className="text-xs font-semibold text-gray-800">{COPShort(c.ventas)}</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-500 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Distribución de estados */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-gray-700">Estado de órdenes</h2>
                      <span className="text-xs text-gray-400">{periodLabel}</span>
                    </div>
                    {!statusDist ? (
                      <p className="text-xs text-gray-300 text-center py-6">Sin datos en el período</p>
                    ) : (
                      <div className="space-y-4">
                        {/* Summary numbers */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-xl font-bold text-gray-900">{statusDist.total}</p>
                            <p className="text-xs text-gray-400">Total</p>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-green-600">{statusDist.completed}</p>
                            <p className="text-xs text-gray-400">Entregadas</p>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-amber-500">{statusDist.pending}</p>
                            <p className="text-xs text-gray-400">Pendientes</p>
                          </div>
                        </div>

                        {/* Progress bars */}
                        <div className="space-y-2.5">
                          <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>Entregadas</span>
                              <span className="font-medium text-green-600">{statusDist.pctCompleted}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${statusDist.pctCompleted}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>Pendientes</span>
                              <span className="font-medium text-amber-500">{statusDist.pctPending}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${statusDist.pctPending}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* Tasa de completadas */}
                        <div className="pt-2 border-t border-gray-50">
                          <p className="text-xs text-gray-400 text-center">
                            Tasa de entrega: <span className={`font-semibold ${statusDist.pctCompleted >= 70 ? 'text-green-600' : statusDist.pctCompleted >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{statusDist.pctCompleted}%</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <p className="text-xs text-gray-300 mt-2 text-center">
              {orders.length} órdenes · Excluye canceladas
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
