import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { db } from '../database/LocalDatabase';
import { orderService, getReceivables, Receivables } from '../services/orders';
import { apiService } from '../services/api';
import { purchaseOrderService } from '../services/purchaseOrders';
import { productService } from '../services/products';
import { useProductStore } from '../store/productStore';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { format, subDays, subMonths, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  TrendingUp, ShoppingCart, DollarSign, RefreshCw,
  WifiOff, Package, Users, Warehouse, AlertTriangle, TrendingDown,
  CheckCircle, Clock, FileText, PiggyBank, CreditCard,
} from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

type Period = 'daily' | 'monthly' | 'annual';
type Tab = 'ventas' | 'inventario' | 'compras' | 'rentabilidad' | 'cartera';

interface OrderRow {
  totalAmount: number;
  createdAt: string;
  customerId: number;
  customerName: string;
  status: string;
}

interface PORow {
  id: number;
  poNumber: string;
  supplierId: number;
  supplierName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

const COPShort = (n: number) => {
  if (n === 0) return '$0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name === 'ventas' || p.name === 'compras' ? COP(p.value) : `${p.value}`}
        </p>
      ))}
    </div>
  );
};

const COL_TZ = 'America/Bogota';
const colDay = (isoStr: string): string =>
  new Date(isoStr).toLocaleDateString('en-CA', { timeZone: COL_TZ });
const colMonth = (d: Date): string => colDay(d.toISOString()).substring(0, 7);
const colYear = (d: Date): string => colDay(d.toISOString()).substring(0, 4);
const colStartOfDay = (d: Date): Date => new Date(`${colDay(d.toISOString())}T05:00:00.000Z`);
const colStartOfMonth = (d: Date): Date => {
  const [y, m] = colDay(d.toISOString()).split('-');
  return new Date(`${y}-${m}-01T05:00:00.000Z`);
};

const barColor = (value: number, max: number) => {
  if (value === 0 || max === 0) return '#e5e7eb';
  const t = value / max;
  const r = Math.round(147 + (29 - 147) * t);
  const g = Math.round(197 + (78 - 197) * t);
  const b = Math.round(253 + (216 - 253) * t);
  return `rgb(${r},${g},${b})`;
};

const Reports: React.FC = () => {
  const [tab, setTab] = useState<Tab>('rentabilidad');

  // Cartera: crédito pendiente de cobro
  const [receivables, setReceivables] = useState<Receivables | null>(null);
  useEffect(() => {
    if (navigator.onLine) getReceivables().then(setReceivables).catch(() => setReceivables(null));
  }, []);

  const carteraByCustomer = useMemo(() => {
    if (!receivables) return [];
    const map = new Map<string, { name: string; total: number; count: number; overdue: number }>();
    for (const o of receivables.orders) {
      const key = o.customer?.name ?? 'Sin cliente';
      const e = map.get(key) ?? { name: key, total: 0, count: 0, overdue: 0 };
      e.total += o.totalAmount;
      e.count += 1;
      if (o.daysUntilDue !== null && o.daysUntilDue < 0) e.overdue += 1;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [receivables]);
  const [period, setPeriod] = useState<Period>('daily');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PORow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const { products, getProducts } = useProductStore();

  const loadData = useCallback(async () => {
    setLoading(true);
    setIsOffline(!navigator.onLine);
    try {
      if (navigator.onLine) {
        const [ordersRes, poRes] = await Promise.all([
          orderService.getOrders(1, 2000),
          purchaseOrderService.getAll(1, 500),
        ]);
        setOrders(
          (ordersRes.data ?? [])
            .filter((o: any) => o.status !== 'cancelled')
            .map((o: any) => ({
              totalAmount: Number(o.totalAmount),
              createdAt: o.createdAt,
              customerId: o.customerId,
              customerName: o.customer?.name ?? `Cliente #${o.customerId}`,
              status: o.status,
            }))
        );
        setPurchaseOrders(
          (poRes.data ?? []).map((po: any) => ({
            id: po.id,
            poNumber: po.poNumber,
            supplierId: po.supplierId,
            supplierName: po.supplier?.name ?? `Proveedor #${po.supplierId}`,
            totalAmount: Number(po.totalAmount),
            status: po.status,
            createdAt: po.createdAt,
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
      await getProducts(1, 2000, false);
    } finally {
      setLoading(false);
    }
  }, [getProducts]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── VENTAS: Chart data ───────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const now = new Date();
    if (period === 'daily') {
      return Array.from({ length: 30 }, (_, i) => {
        const day = subDays(now, 29 - i);
        const dayStr = colDay(day.toISOString());
        const slice = orders.filter(o => colDay(o.createdAt) === dayStr);
        return {
          label: format(colStartOfDay(day), 'dd/MM', { locale: es }),
          ventas: slice.reduce((s, o) => s + o.totalAmount, 0),
          ordenes: slice.length,
        };
      });
    }
    if (period === 'monthly') {
      return Array.from({ length: 12 }, (_, i) => {
        const month = subMonths(now, 11 - i);
        const monthStr = colMonth(month);
        const slice = orders.filter(o => colDay(o.createdAt).startsWith(monthStr));
        return {
          label: format(colStartOfMonth(month), 'MMM yy', { locale: es }),
          ventas: slice.reduce((s, o) => s + o.totalAmount, 0),
          ordenes: slice.length,
        };
      });
    }
    return Array.from({ length: 5 }, (_, i) => {
      const year = parseInt(colYear(now)) - 4 + i;
      const slice = orders.filter(o => colDay(o.createdAt).startsWith(String(year)));
      return {
        label: String(year),
        ventas: slice.reduce((s, o) => s + o.totalAmount, 0),
        ordenes: slice.length,
      };
    });
  }, [orders, period]);

  const kpis = useMemo(() => {
    const now = new Date();
    const todayStr = colDay(now.toISOString());
    const monthStr = todayStr.substring(0, 7);
    const prevMonthStr = colMonth(subMonths(now, 1));
    const sumBy = (pred: (o: OrderRow) => boolean) => orders.filter(pred).reduce((s, o) => s + o.totalAmount, 0);
    const cntBy = (pred: (o: OrderRow) => boolean) => orders.filter(pred).length;
    const isToday = (o: OrderRow) => colDay(o.createdAt) === todayStr;
    const isMonth = (o: OrderRow) => colDay(o.createdAt).startsWith(monthStr);
    const isPrevM = (o: OrderRow) => colDay(o.createdAt).startsWith(prevMonthStr);
    const monthVentas = sumBy(isMonth);
    const prevMonthVentas = sumBy(isPrevM);
    const monthPct = prevMonthVentas > 0
      ? Math.round(((monthVentas - prevMonthVentas) / prevMonthVentas) * 100)
      : null;
    const allVentas = sumBy(() => true);
    const allCount = cntBy(() => true);
    return {
      today: { ventas: sumBy(isToday), ordenes: cntBy(isToday) },
      month: { ventas: monthVentas, ordenes: cntBy(isMonth), clientes: new Set(orders.filter(isMonth).map(o => o.customerId)).size, pct: monthPct },
      avgTicket: allCount > 0 ? Math.round(allVentas / allCount) : 0,
      all: { ventas: allVentas, ordenes: allCount },
    };
  }, [orders]);

  const periodOrders = useMemo(() => {
    const now = new Date();
    let from: Date;
    if (period === 'daily') from = subDays(now, 29);
    else if (period === 'monthly') from = subMonths(now, 11);
    else from = subYears(now, 4);
    const fromDayStr = colDay(colStartOfDay(from).toISOString());
    return orders.filter(o => colDay(o.createdAt) >= fromDayStr);
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
    const pending = periodOrders.filter(o => o.status === 'pending').length;
    return {
      completed, pending, total,
      pctCompleted: Math.round((completed / total) * 100),
      pctPending: Math.round((pending / total) * 100),
    };
  }, [periodOrders]);

  const maxVentas = useMemo(() => Math.max(...chartData.map(d => d.ventas), 1), [chartData]);

  // ── INVENTARIO: Stats ────────────────────────────────────────────────────
  const invStats = useMemo(() => {
    const negative = products.filter(p => p.stock < 0);
    const outOfStock = products.filter(p => p.stock === 0);
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock);
    const ok = products.filter(p => p.stock > p.minStock);
    const totalValue = products.reduce((s, p) => s + (p.stock > 0 ? p.stock * p.salePrice : 0), 0);
    const topStock = [...products]
      .filter(p => p.stock > 0)
      .sort((a, b) => b.stock * b.salePrice - a.stock * a.salePrice)
      .slice(0, 8);

    // Valor a costo — solo si se pudo cargar productCosts (online). Un producto sin costo
    // registrado (sin compras ni precios de proveedor) no suma al total, igual que en COGS.
    const hasCostData = productCosts !== null;
    let totalCostValue = 0;
    let productsWithoutCost = 0;
    if (hasCostData) {
      for (const p of products) {
        if (p.stock <= 0) continue;
        const cost = productCosts![p.id];
        if (cost === undefined) { productsWithoutCost++; continue; }
        totalCostValue += p.stock * cost;
      }
    }
    const potentialProfit = totalValue - totalCostValue;
    const potentialMargin = totalValue > 0 ? (potentialProfit / totalValue) * 100 : 0;

    return {
      negative, outOfStock, lowStock, ok, totalValue, topStock,
      hasCostData, totalCostValue, productsWithoutCost, potentialProfit, potentialMargin,
    };
  }, [products, productCosts]);

  const invChartData = useMemo(() => [
    { label: 'Negativo', value: invStats.negative.length, fill: '#ef4444' },
    { label: 'Sin stock', value: invStats.outOfStock.length, fill: '#f97316' },
    { label: 'Stock bajo', value: invStats.lowStock.length, fill: '#f59e0b' },
    { label: 'OK', value: invStats.ok.length, fill: '#22c55e' },
  ], [invStats]);

  // ── COMPRAS: Stats ───────────────────────────────────────────────────────
  const poStats = useMemo(() => {
    const now = new Date();
    const monthStr = colDay(now.toISOString()).substring(0, 7);
    const received = purchaseOrders.filter(p => p.status === 'received');
    const ordered = purchaseOrders.filter(p => p.status === 'ordered');
    const draft = purchaseOrders.filter(p => p.status === 'draft');
    const totalInvested = received.reduce((s, p) => s + p.totalAmount, 0);
    const monthInvested = received
      .filter(p => colDay(p.createdAt).startsWith(monthStr))
      .reduce((s, p) => s + p.totalAmount, 0);

    // Top proveedores por monto
    const supplierMap = new Map<string, { name: string; total: number; count: number }>();
    purchaseOrders.forEach(po => {
      const cur = supplierMap.get(po.supplierName) ?? { name: po.supplierName, total: 0, count: 0 };
      supplierMap.set(po.supplierName, { ...cur, total: cur.total + po.totalAmount, count: cur.count + 1 });
    });
    const topSuppliers = [...supplierMap.values()].sort((a, b) => b.total - a.total).slice(0, 5);

    // Compras por mes (últimos 6)
    const monthlyChart = Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(now, 5 - i);
      const ms = colMonth(month);
      const slice = purchaseOrders.filter(p => colDay(p.createdAt).startsWith(ms));
      return {
        label: format(colStartOfMonth(month), 'MMM yy', { locale: es }),
        compras: slice.reduce((s, p) => s + p.totalAmount, 0),
        ordenes: slice.length,
      };
    });

    return { received, ordered, draft, totalInvested, monthInvested, topSuppliers, monthlyChart };
  }, [purchaseOrders]);

  const maxCompras = useMemo(() => Math.max(...poStats.monthlyChart.map(d => d.compras), 1), [poStats]);

  // ── RENTABILIDAD: Stats ──────────────────────────────────────────────────
  const rentStats = useMemo(() => {
    const now = new Date();
    const monthStr = colDay(now.toISOString()).substring(0, 7);
    const prevMonthStr = colMonth(subMonths(now, 1));

    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalCost = purchaseOrders
      .filter(p => p.status === 'received')
      .reduce((s, p) => s + p.totalAmount, 0);
    const grossProfit = totalRevenue - totalCost;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const monthRevenue = orders
      .filter(o => colDay(o.createdAt).startsWith(monthStr))
      .reduce((s, o) => s + o.totalAmount, 0);
    const monthCost = purchaseOrders
      .filter(p => p.status === 'received' && colDay(p.createdAt).startsWith(monthStr))
      .reduce((s, p) => s + p.totalAmount, 0);
    const monthProfit = monthRevenue - monthCost;
    const monthMargin = monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0;

    const prevRevenue = orders
      .filter(o => colDay(o.createdAt).startsWith(prevMonthStr))
      .reduce((s, o) => s + o.totalAmount, 0);
    const prevCost = purchaseOrders
      .filter(p => p.status === 'received' && colDay(p.createdAt).startsWith(prevMonthStr))
      .reduce((s, p) => s + p.totalAmount, 0);
    const prevProfit = prevRevenue - prevCost;
    const profitPct = prevProfit !== 0
      ? Math.round(((monthProfit - prevProfit) / Math.abs(prevProfit)) * 100)
      : null;

    // Últimos 12 meses
    const monthlyChart = Array.from({ length: 12 }, (_, i) => {
      const month = subMonths(now, 11 - i);
      const ms = colMonth(month);
      const rev = orders
        .filter(o => colDay(o.createdAt).startsWith(ms))
        .reduce((s, o) => s + o.totalAmount, 0);
      const cost = purchaseOrders
        .filter(p => p.status === 'received' && colDay(p.createdAt).startsWith(ms))
        .reduce((s, p) => s + p.totalAmount, 0);
      return {
        label: format(colStartOfMonth(month), 'MMM yy', { locale: es }),
        ingresos: rev,
        costos: cost,
        utilidad: rev - cost,
      };
    });

    // Mejor mes por utilidad
    const bestMonth = [...monthlyChart].sort((a, b) => b.utilidad - a.utilidad)[0];

    return {
      totalRevenue, totalCost, grossProfit, grossMargin,
      monthRevenue, monthCost, monthProfit, monthMargin, profitPct,
      monthlyChart, bestMonth,
      hasCostData: totalCost > 0,
    };
  }, [orders, purchaseOrders]);

  // Rentabilidad real desde el servidor: utilidad = ventas − costo de lo vendido (COGS).
  // Reemplaza el cálculo viejo (ventas − compras del período) que castigaba la carga de inventario.
  const [profit, setProfit] = useState<{
    months: Array<{ month: string; revenue: number; cogs: number; profit: number; margin: number }>;
    current: { month: string; revenue: number; cogs: number; profit: number; margin: number };
    purchasesThisMonth: number;
    productsWithoutCost: number;
  } | null>(null);

  useEffect(() => {
    if (!navigator.onLine) return;
    apiService.get<{ status: string; data: never }>('/orders/stats/profit')
      .then(r => setProfit(r.data as never))
      .catch(() => setProfit(null));
  }, []);

  // Costo por producto para el valor de stock a costo (Inventario) — mismo dato del COGS
  // de Rentabilidad. Offline o si falla, el tab de Inventario simplemente no muestra costo.
  const [productCosts, setProductCosts] = useState<Record<number, number> | null>(null);
  useEffect(() => {
    if (!navigator.onLine) return;
    productService.getCosts()
      .then(setProductCosts)
      .catch(() => setProductCosts(null));
  }, []);

  const rent = useMemo(() => {
    if (!profit) return rentStats;
    const byMonth = new Map(profit.months.map(m => [m.month, m]));
    const now = new Date();
    const monthlyChart = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, 11 - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const m = byMonth.get(key);
      return {
        label: format(colStartOfMonth(d), 'MMM yy', { locale: es }),
        ingresos: m?.revenue ?? 0,
        costos: m?.cogs ?? 0,
        utilidad: m?.profit ?? 0,
      };
    });
    const totalRevenue = profit.months.reduce((s, m) => s + m.revenue, 0);
    const totalCost = profit.months.reduce((s, m) => s + m.cogs, 0);
    const grossProfit = totalRevenue - totalCost;
    const prevKey = (() => { const d = subMonths(now, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
    const prev = byMonth.get(prevKey);
    return {
      ...rentStats,
      totalRevenue,
      totalCost,
      grossProfit,
      grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      monthRevenue: profit.current.revenue,
      monthCost: profit.current.cogs,
      monthProfit: profit.current.profit,
      monthMargin: profit.current.margin,
      profitPct: prev && prev.profit !== 0 ? Math.round(((profit.current.profit - prev.profit) / Math.abs(prev.profit)) * 100) : null,
      monthlyChart,
      hasCostData: profit.months.some(m => m.cogs > 0),
    };
  }, [profit, rentStats]);

  const downloadMonthlyReport = async (month: string) => {
    try {
      const token = localStorage.getItem('vf_token');
      const r = await fetch(`/api/orders/report/monthly?month=${month}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error('error');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-ventas-${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo descargar el reporte');
    }
  };
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const hasData = orders.length > 0;

  const periods: { key: Period; label: string }[] = [
    { key: 'daily', label: '30 días' },
    { key: 'monthly', label: '12 meses' },
    { key: 'annual', label: '5 años' },
  ];
  const periodLabel = periods.find(p => p.key === period)?.label ?? '';

  const tabs: { key: Tab; label: string; icon: React.FC<any> }[] = [
    { key: 'rentabilidad',  label: 'Rentabilidad',  icon: PiggyBank },
    { key: 'ventas',        label: 'Ventas',        icon: TrendingUp },
    { key: 'cartera',       label: 'Cartera',       icon: CreditCard },
    { key: 'compras',       label: 'Compras',       icon: ShoppingCart },
    { key: 'inventario',    label: 'Inventario',    icon: Warehouse },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">

        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 px-2">Informes</h1>
          <p className="text-sm sm:text-lg text-gray-600 px-2">
            {isOffline ? 'Datos locales (sin conexión)' : 'Ventas, cartera, compras e inventario de tu negocio.'}
          </p>
        </div>
        <div className="flex justify-end mb-4">
          <button
            onClick={loadData}
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

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 shadow-sm w-full sm:w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                tab === t.key ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <t.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
        ) : (
          <>
            {/* ════════════════ TAB: CARTERA ════════════════ */}
            {tab === 'cartera' && (
              <>
                {!receivables || receivables.count === 0 ? (
                  <div className="text-center py-20">
                    <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-gray-900 mb-1">Sin cuentas por cobrar</h3>
                    <p className="text-sm text-gray-400 max-w-sm mx-auto">
                      No hay órdenes a crédito pendientes de pago. Las ventas a crédito aparecerán aquí hasta que se marquen pagadas.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
                            <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                          <p className="text-xs text-gray-400">Por cobrar</p>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{COP(receivables.totalDue)}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <p className="text-xs text-gray-400">Órdenes a crédito</p>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-gray-900">{receivables.count}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${receivables.overdueCount ? 'bg-red-50' : 'bg-gray-50'}`}>
                            <AlertTriangle className={`w-3.5 h-3.5 ${receivables.overdueCount ? 'text-red-500' : 'text-gray-300'}`} />
                          </div>
                          <p className="text-xs text-gray-400">Vencidas</p>
                        </div>
                        <p className={`text-lg sm:text-xl font-bold ${receivables.overdueCount ? 'text-red-600' : 'text-gray-900'}`}>{receivables.overdueCount}</p>
                      </div>
                    </div>

                    {/* Deuda por cliente */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 mb-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4 text-gray-400" />
                        <h3 className="text-sm font-semibold text-gray-900">Deuda por cliente</h3>
                      </div>
                      <div className="space-y-3">
                        {carteraByCustomer.map(c => (
                          <div key={c.name} className="flex items-center gap-3">
                            <div className="w-32 sm:w-44 flex-shrink-0 min-w-0">
                              <p className="text-xs font-medium text-gray-700 truncate">{c.name}</p>
                              <p className="text-[11px] text-gray-400">
                                {c.count} orden{c.count !== 1 ? 'es' : ''}{c.overdue > 0 && <span className="text-red-500"> · {c.overdue} vencida{c.overdue !== 1 ? 's' : ''}</span>}
                              </p>
                            </div>
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${c.overdue > 0 ? 'bg-red-400' : 'bg-amber-400'}`}
                                style={{ width: `${Math.max(6, (c.total / (carteraByCustomer[0]?.total || 1)) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-700 w-20 text-right flex-shrink-0">{COP(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Detalle de órdenes */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-gray-200">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <h3 className="text-sm font-semibold text-gray-900">Órdenes pendientes de cobro</h3>
                      </div>
                      <ul className="divide-y divide-gray-100">
                        {receivables.orders.map(o => (
                          <li key={o.id} className="flex items-center justify-between px-4 sm:px-5 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                #{o.orderNumber}
                                {o.customer && <span className="text-gray-500 font-normal"> · {o.customer.name}</span>}
                              </p>
                              {o.paymentDueDate && (
                                <p className={`text-[11px] ${o.daysUntilDue !== null && o.daysUntilDue < 0 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                                  {o.daysUntilDue === null ? '' :
                                    o.daysUntilDue < 0 ? `Venció hace ${-o.daysUntilDue} día${o.daysUntilDue === -1 ? '' : 's'}` :
                                    o.daysUntilDue === 0 ? 'Vence HOY' :
                                    `Vence en ${o.daysUntilDue} día${o.daysUntilDue === 1 ? '' : 's'}`}
                                </p>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-gray-800 flex-shrink-0 ml-3">{COP(o.totalAmount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ════════════════ TAB: VENTAS ════════════════ */}
            {tab === 'ventas' && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Hoy</span>
                    </div>
                    <p className={`text-lg font-bold ${kpis.today.ventas > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                      {COPShort(kpis.today.ventas)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{kpis.today.ordenes} órden{kpis.today.ordenes !== 1 ? 'es' : ''}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 text-primary" />
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
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
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
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-orange-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Total histórico</span>
                    </div>
                    <p className={`text-lg font-bold ${kpis.all.ventas > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                      {COPShort(kpis.all.ventas)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{kpis.all.ordenes} órdenes</p>
                  </div>
                </div>

                <div className="flex gap-1 mb-5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm w-full sm:w-fit">
                  {periods.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setPeriod(p.key)}
                      className={`flex-1 sm:flex-none px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                        period === p.key ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {!hasData ? (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">Sin datos de ventas</p>
                    <p className="text-gray-300 text-sm mt-1">Crea órdenes para ver los informes</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
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
                            {chartData.map((entry, i) => <Cell key={i} fill={barColor(entry.ventas, maxVentas)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
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
                          <Line dataKey="ordenes" name="ordenes" stroke="#3b82f6" strokeWidth={2}
                            dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: '#1d4ed8' }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
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
                                ? Math.round((c.ventas / periodOrders.reduce((s, o) => s + o.totalAmount, 0)) * 100) : 0;
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
                                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-sm font-semibold text-gray-700">Estado de órdenes</h2>
                          <span className="text-xs text-gray-400">{periodLabel}</span>
                        </div>
                        {!statusDist ? (
                          <p className="text-xs text-gray-300 text-center py-6">Sin datos en el período</p>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div><p className="text-xl font-bold text-gray-900">{statusDist.total}</p><p className="text-xs text-gray-400">Total</p></div>
                              <div><p className="text-xl font-bold text-green-600">{statusDist.completed}</p><p className="text-xs text-gray-400">Entregadas</p></div>
                              <div><p className="text-xl font-bold text-amber-500">{statusDist.pending}</p><p className="text-xs text-gray-400">Pendientes</p></div>
                            </div>
                            <div className="space-y-2.5">
                              <div>
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                  <span>Entregadas</span><span className="font-medium text-green-600">{statusDist.pctCompleted}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${statusDist.pctCompleted}%` }} />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                  <span>Pendientes</span><span className="font-medium text-amber-500">{statusDist.pctPending}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${statusDist.pctPending}%` }} />
                                </div>
                              </div>
                            </div>
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
                <p className="text-xs text-gray-300 mt-2 text-center">{orders.length} órdenes · Excluye canceladas</p>
              </>
            )}

            {/* ════════════════ TAB: INVENTARIO ════════════════ */}
            {tab === 'inventario' && (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-indigo-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Productos</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{products.length}</p>
                    <p className="text-xs text-gray-400 mt-0.5">registrados</p>
                  </div>
                  <div className={`rounded-xl border shadow-sm p-4 ${invStats.negative.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Negativos</span>
                    </div>
                    <p className={`text-lg font-bold ${invStats.negative.length > 0 ? 'text-red-700' : 'text-gray-900'}`}>{invStats.negative.length}</p>
                    <p className="text-xs text-gray-400 mt-0.5">requieren compra urgente</p>
                  </div>
                  <div className={`rounded-xl border shadow-sm p-4 ${invStats.outOfStock.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Sin stock</span>
                    </div>
                    <p className={`text-lg font-bold ${invStats.outOfStock.length > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{invStats.outOfStock.length}</p>
                    <p className="text-xs text-gray-400 mt-0.5">en cero</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-green-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Valor stock</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{COPShort(invStats.totalValue)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">a precio de venta</p>
                  </div>
                </div>

                {/* Valor a costo — solo con datos de costo cargados (online) */}
                {invStats.hasCostData && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <h3 className="text-sm font-semibold text-gray-700">Valor del inventario</h3>
                      {invStats.productsWithoutCost > 0 && (
                        <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          {invStats.productsWithoutCost} producto{invStats.productsWithoutCost !== 1 ? 's' : ''} sin costo registrado
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">A precio de venta</p>
                        <p className="text-sm font-bold text-gray-900">{COPShort(invStats.totalValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">A costo</p>
                        <p className="text-sm font-bold text-orange-600">{COPShort(invStats.totalCostValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Utilidad potencial</p>
                        <p className={`text-sm font-bold ${invStats.potentialProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {COPShort(invStats.potentialProfit)}
                        </p>
                        <p className="text-xs text-gray-400">{invStats.potentialMargin.toFixed(0)}% margen</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Distribución estado */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Distribución de stock</h2>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={invChartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                        <Bar dataKey="value" name="productos" radius={[4, 4, 0, 0]} maxBarSize={50}>
                          {invChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {invChartData.map(d => (
                        <div key={d.label} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.fill }} />
                          <span className="text-xs text-gray-500">{d.label}: <span className="font-semibold text-gray-700">{d.value}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top por valor */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Top productos por valor en stock</h2>
                    {invStats.topStock.length === 0 ? (
                      <p className="text-xs text-gray-300 text-center py-6">Sin stock disponible</p>
                    ) : (
                      <div className="space-y-3">
                        {invStats.topStock.map((p, i) => {
                          const val = p.stock * p.salePrice;
                          const pct = invStats.totalValue > 0 ? Math.round((val / invStats.totalValue) * 100) : 0;
                          const cost = invStats.hasCostData ? productCosts![p.id] : undefined;
                          return (
                            <div key={p.id}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-bold text-gray-300 w-4 flex-shrink-0">#{i + 1}</span>
                                  <span className="text-xs font-medium text-gray-700 truncate">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  <span className="text-xs text-gray-400">{Number(p.stock).toLocaleString('es-CO')} {p.unit}</span>
                                  <span className="text-xs font-semibold text-gray-800">{COPShort(val)}</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              {invStats.hasCostData && (
                                <p className="text-[11px] text-gray-400 mt-0.5 text-right">
                                  {cost !== undefined ? `costo: ${COPShort(p.stock * cost)}` : 'sin costo registrado'}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Productos con stock negativo */}
                {invStats.negative.length > 0 && (
                  <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 mb-4">
                    <h2 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Productos con stock negativo — requieren reposición
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-xs uppercase text-gray-500 border-b">
                          <tr>
                            <th className="py-2 text-left">Código</th>
                            <th className="py-2 text-left">Producto</th>
                            <th className="py-2 text-center">Stock actual</th>
                            <th className="py-2 text-center">Mínimo</th>
                            <th className="py-2 text-right">Unidades a reponer</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {invStats.negative.map(p => (
                            <tr key={p.id}>
                              <td className="py-2 font-mono text-xs text-gray-500">{p.code}</td>
                              <td className="py-2 font-medium text-gray-800">{p.name}</td>
                              <td className="py-2 text-center font-bold text-red-600">{Number(p.stock).toLocaleString('es-CO')} {p.unit}</td>
                              <td className="py-2 text-center text-gray-500">{Number(p.minStock).toLocaleString('es-CO')} {p.unit}</td>
                              <td className="py-2 text-right font-semibold text-orange-600">
                                {Math.abs(p.stock) + p.minStock} {p.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-300 mt-2 text-center">
                  {products.length} productos · Valor calculado a precio de venta
                  {invStats.hasCostData ? ' y a costo' : ' (conéctate para ver el costo)'}
                </p>
              </>
            )}

            {/* ════════════════ TAB: COMPRAS ════════════════ */}
            {tab === 'compras' && (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Invertido (recibido)</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{COPShort(poStats.totalInvested)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{poStats.received.length} órd. recibidas</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Este mes</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{COPShort(poStats.monthInvested)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">en compras recibidas</p>
                  </div>
                  <div className={`rounded-xl border shadow-sm p-4 ${poStats.ordered.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-amber-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">En tránsito</span>
                    </div>
                    <p className={`text-lg font-bold ${poStats.ordered.length > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{poStats.ordered.length}</p>
                    <p className="text-xs text-gray-400 mt-0.5">órd. ordenadas</p>
                  </div>
                  <div className={`rounded-xl border shadow-sm p-4 ${poStats.draft.length > 0 ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Borradores</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{poStats.draft.length}</p>
                    <p className="text-xs text-gray-400 mt-0.5">sin confirmar</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Gráfica compras mensuales */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-gray-700 mb-1">Compras últimos 6 meses</h2>
                    <p className="text-xs text-gray-400 mb-4">Monto total por mes</p>
                    {purchaseOrders.length === 0 ? (
                      <p className="text-xs text-gray-300 text-center py-6">Sin órdenes de compra</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={poStats.monthlyChart} margin={{ top: 4, right: 4, left: 0, bottom: 4 }} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={COPShort} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={55} domain={[0, maxCompras * 1.15]} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                          <Bar dataKey="compras" name="compras" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {poStats.monthlyChart.map((entry, i) => <Cell key={i} fill={barColor(entry.compras, maxCompras)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Top proveedores */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Top proveedores</h2>
                    {poStats.topSuppliers.length === 0 ? (
                      <p className="text-xs text-gray-300 text-center py-6">Sin órdenes de compra</p>
                    ) : (
                      <div className="space-y-3">
                        {poStats.topSuppliers.map((s, i) => {
                          const pct = poStats.totalInvested > 0 ? Math.round((s.total / poStats.totalInvested) * 100) : 0;
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-bold text-gray-300 w-4 flex-shrink-0">#{i + 1}</span>
                                  <span className="text-xs font-medium text-gray-700 truncate">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  <span className="text-xs text-gray-400">{s.count} órd</span>
                                  <span className="text-xs font-semibold text-gray-800">{COPShort(s.total)}</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Estado de órdenes de compra */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Estado de órdenes de compra</h2>
                  {purchaseOrders.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-6">Sin órdenes de compra registradas</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Borradores', count: poStats.draft.length, icon: FileText, color: 'text-gray-500', bg: 'bg-gray-50' },
                        { label: 'Ordenadas', count: poStats.ordered.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                        { label: 'Recibidas', count: poStats.received.length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
                      ].map(s => (
                        <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
                          <s.icon className={`w-6 h-6 mx-auto mb-2 ${s.color}`} />
                          <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                          {purchaseOrders.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              {Math.round((s.count / purchaseOrders.length) * 100)}%
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-300 mt-2 text-center">{purchaseOrders.length} órdenes de compra · Todas las fechas</p>
              </>
            )}

            {/* ════════════════ TAB: RENTABILIDAD ════════════════ */}
            {tab === 'rentabilidad' && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between mb-4">
                  <p className="text-xs text-gray-400">
                    Utilidad = ventas − costo de lo vendido. Las compras de inventario no se restan.
                    {profit && profit.purchasesThisMonth > 0 && (
                      <span className="block sm:inline sm:ml-1">Compras recibidas este mes: <b className="text-gray-600">{COPShort(profit.purchasesThisMonth)}</b> (informativo)</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
                      max={new Date().toISOString().slice(0, 7)}
                      className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={() => downloadMonthlyReport(reportMonth)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
                    >
                      Descargar Excel del mes
                    </button>
                  </div>
                </div>
                {profit && profit.productsWithoutCost > 0 && (
                  <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      {profit.productsWithoutCost} producto{profit.productsWithoutCost !== 1 ? 's' : ''} vendido{profit.productsWithoutCost !== 1 ? 's' : ''} sin costo registrado — su utilidad se calcula con costo $0.
                      Registra sus compras o el precio del proveedor para afinar el margen.
                    </span>
                  </div>
                )}
                {!rent.hasCostData && (
                  <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    Sin órdenes de compra recibidas — los costos aparecen en $0. Registra compras para ver el margen real.
                  </div>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Ingresos totales</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{COPShort(rent.totalRevenue)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{orders.length} órdenes</p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 text-orange-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Costo de lo vendido</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{COPShort(rent.totalCost)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">de las ventas (no incluye inventario comprado)</p>
                  </div>

                  <div className={`rounded-xl border shadow-sm p-4 ${rent.grossProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${rent.grossProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        <PiggyBank className={`w-4 h-4 ${rent.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`} />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Utilidad bruta</span>
                    </div>
                    <p className={`text-lg font-bold ${rent.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {COPShort(rent.grossProfit)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Ingresos − Costos</p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-violet-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Margen bruto</span>
                    </div>
                    <p className={`text-lg font-bold ${rent.grossMargin >= 30 ? 'text-emerald-700' : rent.grossMargin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                      {rent.grossMargin.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {rent.grossMargin >= 30 ? 'Saludable' : rent.grossMargin >= 10 ? 'Aceptable' : 'Bajo'}
                    </p>
                  </div>
                </div>

                {/* Este mes */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Este mes</h3>
                    {rent.profitPct !== null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                        rent.profitPct >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                      }`}>
                        {rent.profitPct >= 0 ? '+' : ''}{rent.profitPct}%
                        <span className="hidden sm:inline"> vs mes anterior</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Ingresos</p>
                      <p className="text-sm font-bold text-gray-900">{COPShort(rent.monthRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Costos</p>
                      <p className="text-sm font-bold text-orange-600">{COPShort(rent.monthCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Utilidad</p>
                      <p className={`text-sm font-bold ${rent.monthProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {COPShort(rent.monthProfit)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {rent.monthMargin.toFixed(0)}% margen
                      </p>
                    </div>
                  </div>
                </div>

                {/* Gráfica dual: Ingresos vs Costos 12 meses */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Ingresos vs Costos — últimos 12 meses</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={rent.monthlyChart} barGap={2} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={COPShort} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={48} />
                      <Tooltip
                        formatter={(value: number, name: string) => [COP(value), name === 'ingresos' ? 'Ingresos' : name === 'costos' ? 'Costos' : 'Utilidad']}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 12 }}
                      />
                      <Legend formatter={(v) => v === 'ingresos' ? 'Ingresos' : v === 'costos' ? 'Costos' : 'Utilidad'} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="ingresos" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="costos" fill="#fb923c" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Utilidad mensual */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Utilidad mensual</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={rent.monthlyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={COPShort} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={48} />
                      <Tooltip
                        formatter={(v: number) => [COP(v), 'Utilidad']}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 12 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="utilidad"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          return <circle key={props.key} cx={cx} cy={cy} r={3} fill={payload.utilidad >= 0 ? '#6366f1' : '#ef4444'} stroke="none" />;
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {rent.bestMonth && rent.bestMonth.utilidad > 0 && (
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      Mejor mes: <span className="font-semibold text-emerald-600">{rent.bestMonth.label}</span> — {COP(rent.bestMonth.utilidad)}
                    </p>
                  )}
                </div>

                <p className="text-xs text-gray-300 mt-2 text-center">
                  Costos = órdenes de compra en estado "Recibida" · Ingresos = órdenes no canceladas
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
