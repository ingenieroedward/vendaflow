import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Package, TrendingDown, Plus, Search,
  ChevronLeft, ChevronRight, TrendingUp, ShoppingCart,
  ChevronDown, Edit3, X, Save, Zap, ArrowUpToLine,
} from 'lucide-react';
import { useProductStore } from '../store/productStore';
import { usePurchaseOrderStore } from '../store/purchaseOrderStore';
import { useUIStore } from '../store/uiStore';
import { Product } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Button from '../components/ui/Button';
import { productService } from '../services/products';
import InventoryMovements from '../components/features/InventoryMovements';

type FilterType = 'all' | 'negative' | 'alerts' | 'out_of_stock';

const PAGE_SIZE = 50;

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const { products, getProducts, loading } = useProductStore();
  const { fetchStockAlerts } = usePurchaseOrderStore();
  const { addNotification } = useUIStore();

  const [view, setView] = useState<'stock' | 'movements'>('stock');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [alertExpanded, setAlertExpanded] = useState(false);

  // ── Modo edición ──────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [edits, setEdits] = useState<Record<number, number>>({}); // id → nuevo stock
  const [saving, setSaving] = useState(false);
  const [clearingNegatives, setClearingNegatives] = useState(false);

  useEffect(() => {
    getProducts(1, 2000, false);
    fetchStockAlerts();
  }, [getProducts, fetchStockAlerts]);

  useEffect(() => { setPage(1); }, [search, filter]);

  const negativeStock = products.filter(p => p.stock < 0);
  const outOfStock = products.filter(p => p.stock <= 0).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;

  const filtered = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'negative') return p.stock < 0;
    if (filter === 'out_of_stock') return p.stock <= 0;
    if (filter === 'alerts') return p.stock > 0 && p.stock <= p.minStock;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getStockBadge = (product: Product) => {
    if (product.stock < 0) return { label: 'Negativo', className: 'bg-red-200 text-red-800 font-bold' };
    if (product.stock === 0) return { label: 'Sin stock', className: 'bg-red-100 text-red-700' };
    if (product.stock <= product.minStock) return { label: 'Stock bajo', className: 'bg-yellow-100 text-yellow-700' };
    return { label: 'OK', className: 'bg-green-100 text-green-700' };
  };

  const FILTERS: { key: FilterType; label: string; danger?: boolean }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'negative', label: 'Negativo', danger: true },
    { key: 'alerts', label: 'Stock bajo' },
    { key: 'out_of_stock', label: 'Sin stock' },
  ];

  // ── Helpers edición ───────────────────────────────────────────────────────
  const getDisplayStock = (p: Product) =>
    p.id in edits ? edits[p.id] : p.stock;

  const setEdit = (id: number, val: number) =>
    setEdits(prev => ({ ...prev, [id]: val }));

  const cancelEdit = () => { setEdits({}); setEditMode(false); };

  const modifiedCount = Object.keys(edits).length;

  // Acciones masivas sobre los productos del filtro actual
  const applyBulkAction = useCallback((action: 'zero_negative' | 'all_zero' | 'to_minimum') => {
    const targets = action === 'zero_negative'
      ? filtered.filter(p => p.stock < 0)
      : action === 'all_zero'
        ? filtered
        : filtered.filter(p => p.stock < p.minStock);

    setEdits(prev => {
      const next = { ...prev };
      targets.forEach(p => {
        const newVal = action === 'to_minimum' ? p.minStock : 0;
        next[p.id] = newVal;
      });
      return next;
    });
  }, [filtered]);

  const clearAllNegatives = async () => {
    if (negativeStock.length === 0) return;
    const confirmed = window.confirm(
      `¿Poner en 0 los ${negativeStock.length} producto${negativeStock.length !== 1 ? 's' : ''} con stock negativo?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setClearingNegatives(true);
    try {
      await Promise.all(negativeStock.map(p => productService.updateProduct(p.id, { stock: 0 })));
      addNotification({
        type: 'success',
        message: `${negativeStock.length} producto${negativeStock.length !== 1 ? 's' : ''} limpiado${negativeStock.length !== 1 ? 's' : ''} a 0`,
      });
      getProducts(1, 2000, false);
    } catch {
      addNotification({ type: 'error', message: 'Error al limpiar el stock negativo' });
    } finally {
      setClearingNegatives(false);
    }
  };

  const saveAll = async () => {
    if (modifiedCount === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(edits).map(([id, stock]) =>
          productService.updateProduct(Number(id), { stock })
        )
      );
      addNotification({
        type: 'success',
        message: `${modifiedCount} producto${modifiedCount !== 1 ? 's' : ''} actualizado${modifiedCount !== 1 ? 's' : ''}`,
      });
      setEdits({});
      setEditMode(false);
      getProducts(1, 2000, false);
    } catch {
      addNotification({ type: 'error', message: 'Error al guardar algunos cambios' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-32">
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 px-2">Inventario</h1>
        <p className="text-sm sm:text-lg text-gray-600 px-2">Controla el stock de tus productos.</p>
      </div>
      {/* Selector de vista: stock actual vs kardex de movimientos */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5">
          {([['stock', 'Stock'], ['movements', 'Movimientos']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'movements' ? (
        <InventoryMovements />
      ) : (
        <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{products.length} producto(s)</p>
        <div className="flex items-center gap-1.5">
          {!editMode ? (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Edit3 size={13} /> <span className="hidden xs:inline">Editar</span><span className="xs:hidden"> stock</span>
              </button>
              <button
                onClick={() => navigate('/purchase-orders/new')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                <Plus size={13} /> <span>Nueva OC</span>
              </button>
            </>
          ) : (
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <X size={13} /> <span className="hidden xs:inline">Cancelar</span><span className="xs:hidden">✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner modo edición — compacto en mobile */}
      {editMode && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 sm:px-4 sm:py-3">
          {/* Fila 1: título + acciones masivas */}
          <div className="flex items-center gap-2 flex-wrap">
            <Edit3 size={13} className="text-indigo-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-indigo-800 flex-1 whitespace-nowrap">
              Modo edición
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {negativeStock.length > 0 && (
                <button
                  onClick={() => applyBulkAction('zero_negative')}
                  className="flex items-center gap-1 px-2 py-1 bg-red-100 border border-red-300 text-red-700 text-xs rounded-lg hover:bg-red-200 transition-colors"
                >
                  <Zap size={10} />
                  <span className="hidden sm:inline">Negativos → 0</span>
                  <span className="sm:hidden">Neg→0</span>
                  <span className="font-bold">({negativeStock.length})</span>
                </button>
              )}
              <button
                onClick={() => applyBulkAction('to_minimum')}
                className="flex items-center gap-1 px-2 py-1 bg-yellow-100 border border-yellow-300 text-yellow-700 text-xs rounded-lg hover:bg-yellow-200 transition-colors"
              >
                <ArrowUpToLine size={10} />
                <span className="hidden sm:inline">Al mínimo</span>
                <span className="sm:hidden">Mín</span>
              </button>
              <button
                onClick={() => applyBulkAction('all_zero')}
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-colors"
              >
                Todo→0
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerta stock negativo */}
      {negativeStock.length > 0 && (
        <div className="mb-5 rounded-xl border border-red-300 bg-red-50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
            <AlertTriangle className="text-red-500 flex-shrink-0" size={16} />
            <p className="flex-1 font-semibold text-red-800 text-xs sm:text-sm leading-tight">
              {negativeStock.length} producto{negativeStock.length > 1 ? 's' : ''} con stock negativo
            </p>
            <button
              onClick={clearAllNegatives}
              disabled={clearingNegatives}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
            >
              {clearingNegatives ? <LoadingSpinner size="sm" /> : <Zap size={11} />}
              <span>Limpiar a 0</span>
            </button>
            <button
              onClick={() => { setFilter('negative'); setSearch(''); }}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 border border-red-300 text-red-700 bg-white text-xs rounded-lg hover:bg-red-50 transition-colors"
            >
              <ShoppingCart size={11} />
              <span className="hidden xs:inline">Ver</span>
            </button>
            <button
              onClick={() => setAlertExpanded(v => !v)}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
              aria-label={alertExpanded ? 'Colapsar' : 'Expandir'}
            >
              <ChevronDown size={14} className={`transition-transform ${alertExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {alertExpanded && (
            <div className="px-3 pb-3 sm:px-4 sm:pb-4 border-t border-red-200">
              <p className="text-xs text-red-600 mt-2 mb-2">
                Órdenes de venta comprometidas que superan el stock. Crea una orden de compra para reponer:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {negativeStock.slice(0, 8).map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 border border-red-200 rounded-full text-xs text-red-700">
                    {p.code} · <span className="font-bold">{Number(p.stock).toLocaleString('es-CO')} {p.unit}</span>
                  </span>
                ))}
                {negativeStock.length > 8 && (
                  <span className="px-2 py-0.5 bg-red-100 border border-red-200 rounded-full text-xs text-red-600">
                    +{negativeStock.length - 8} más
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Package className="text-indigo-500" size={22} />
            <div>
              <p className="text-xl font-bold text-gray-900">{products.length}</p>
              <p className="text-xs text-gray-500">Totales</p>
            </div>
          </div>
        </div>
        <div
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${negativeStock.length > 0 ? 'bg-red-100 border-red-300 hover:bg-red-200' : 'bg-white border-gray-200'}`}
          onClick={() => setFilter(filter === 'negative' ? 'all' : 'negative')}
        >
          <div className="flex items-center gap-3">
            <TrendingUp className={negativeStock.length > 0 ? 'text-red-600' : 'text-gray-400'} size={22} />
            <div>
              <p className={`text-xl font-bold ${negativeStock.length > 0 ? 'text-red-700' : 'text-gray-900'}`}>{negativeStock.length}</p>
              <p className="text-xs text-gray-500">Stock negativo</p>
            </div>
          </div>
        </div>
        <div
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${outOfStock > 0 ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-white border-gray-200'}`}
          onClick={() => setFilter(filter === 'out_of_stock' ? 'all' : 'out_of_stock')}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className={outOfStock > 0 ? 'text-red-500' : 'text-gray-400'} size={22} />
            <div>
              <p className={`text-xl font-bold ${outOfStock > 0 ? 'text-red-700' : 'text-gray-900'}`}>{outOfStock}</p>
              <p className="text-xs text-gray-500">Sin stock</p>
            </div>
          </div>
        </div>
        <div
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${lowStock > 0 ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' : 'bg-white border-gray-200'}`}
          onClick={() => setFilter(filter === 'alerts' ? 'all' : 'alerts')}
        >
          <div className="flex items-center gap-3">
            <TrendingDown className={lowStock > 0 ? 'text-yellow-500' : 'text-gray-400'} size={22} />
            <div>
              <p className={`text-xl font-bold ${lowStock > 0 ? 'text-yellow-700' : 'text-gray-900'}`}>{lowStock}</p>
              <p className="text-xs text-gray-500">Stock bajo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                filter === f.key
                  ? f.danger ? 'bg-red-600 text-white border-red-600' : 'bg-indigo-600 text-white border-indigo-600'
                  : f.danger && negativeStock.length > 0
                    ? 'bg-white text-red-600 border-red-300 hover:bg-red-50'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f.label}{f.key === 'negative' && negativeStock.length > 0 ? ` (${negativeStock.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-2">
            {paginated.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                {search ? 'No se encontraron productos' : 'Sin productos que mostrar'}
              </p>
            ) : paginated.map(product => {
              const displayStock = getDisplayStock(product);
              const isEdited = product.id in edits;
              const badge = getStockBadge({ ...product, stock: displayStock });
              return (
                <div
                  key={product.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    isEdited ? 'bg-indigo-50 border-indigo-300' :
                    displayStock < 0 ? 'bg-red-50 border-red-200' :
                    displayStock === 0 ? 'bg-red-50/60 border-red-100' :
                    displayStock <= product.minStock ? 'bg-yellow-50/60 border-yellow-100' :
                    'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 text-sm leading-tight truncate">{product.name}</p>
                      <p className="font-mono text-xs text-gray-400 mt-0.5">{product.code}</p>
                    </div>
                    <span className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      {editMode ? (
                        <input
                          type="number"
                          value={displayStock}
                          onChange={e => setEdit(product.id, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border-2 border-indigo-400 rounded-lg text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <span className={`text-xl font-bold ${displayStock < 0 ? 'text-red-600' : displayStock === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                          {Number(displayStock).toLocaleString('es-CO')}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{product.unit}</span>
                      <span className="text-xs text-gray-400">/ mín {Number(product.minStock).toLocaleString('es-CO')}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">${Number(product.salePrice).toLocaleString('es-CO')}</span>
                  </div>
                  {product.category?.name && (
                    <p className="text-xs text-gray-400 mt-1">{product.category.name}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: tabla */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Código</th>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-center">
                    {editMode ? (
                      <span className="text-indigo-600 flex items-center justify-center gap-1">
                        <Edit3 size={11} /> Stock actual
                      </span>
                    ) : 'Stock actual'}
                  </th>
                  <th className="px-4 py-3 text-center">Mínimo</th>
                  <th className="px-4 py-3 text-right">Precio venta</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      {search ? 'No se encontraron productos' : 'Sin productos que mostrar'}
                    </td>
                  </tr>
                ) : paginated.map(product => {
                  const displayStock = getDisplayStock(product);
                  const isEdited = product.id in edits;
                  const badge = getStockBadge({ ...product, stock: displayStock });
                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors ${
                        isEdited ? 'bg-indigo-50' :
                        displayStock < 0 ? 'bg-red-50 hover:bg-red-100' :
                        displayStock === 0 ? 'bg-red-50/40 hover:bg-red-50' :
                        displayStock <= product.minStock ? 'bg-yellow-50/40 hover:bg-yellow-50' :
                        'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{product.code}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{product.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{product.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            value={displayStock}
                            onChange={e => setEdit(product.id, parseFloat(e.target.value) || 0)}
                            className={`w-24 px-2 py-1 border-2 rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              isEdited ? 'border-indigo-400 bg-white' : 'border-gray-300 bg-white'
                            }`}
                          />
                        ) : (
                          <>
                            <span className={`font-bold text-base ${displayStock < 0 ? 'text-red-600' : displayStock === 0 ? 'text-red-500' : 'text-gray-800'}`}>
                              {Number(displayStock).toLocaleString('es-CO')}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">{product.unit}</span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {Number(product.minStock).toLocaleString('es-CO')} {product.unit}
                      </td>
                      <td className="px-4 py-3 text-right">${Number(product.salePrice).toLocaleString('es-CO')}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-sm text-gray-500">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} productos
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 text-sm rounded-lg border transition-colors ${
                        p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Barra flotante de guardado ──────────────────────────────────────── */}
      {editMode && (
        <div className={`fixed bottom-16 md:bottom-0 inset-x-0 z-50 flex justify-center px-4 pb-4 pt-2 pointer-events-none`}>
          <div className={`pointer-events-auto w-full max-w-lg bg-white border shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3 transition-all ${
            modifiedCount > 0 ? 'border-indigo-300' : 'border-gray-200'
          }`}>
            <div className="flex-1 min-w-0">
              {modifiedCount > 0 ? (
                <p className="text-sm font-semibold text-indigo-700">
                  {modifiedCount} producto{modifiedCount !== 1 ? 's' : ''} modificado{modifiedCount !== 1 ? 's' : ''}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Sin cambios — edita el stock en la tabla</p>
              )}
            </div>
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={saveAll}
              disabled={modifiedCount === 0 || saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <LoadingSpinner size="sm" /> : <Save size={14} />}
              {saving ? 'Guardando...' : 'Guardar todo'}
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default Inventory;
