import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Package, TrendingDown, Plus, Search, ChevronLeft, ChevronRight, TrendingUp, ShoppingCart } from 'lucide-react';
import { useProductStore } from '../store/productStore';
import { usePurchaseOrderStore } from '../store/purchaseOrderStore';
import { Product } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Button from '../components/ui/Button';

type FilterType = 'all' | 'negative' | 'alerts' | 'out_of_stock';

const PAGE_SIZE = 50;

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const { products, getProducts, loading } = useProductStore();
  const { fetchStockAlerts } = usePurchaseOrderStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);

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

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} producto(s) registrado(s)</p>
        </div>
        <Button onClick={() => navigate('/purchase-orders/new')} className="flex items-center gap-2">
          <Plus size={16} /> Nueva Orden de Compra
        </Button>
      </div>

      {/* Alerta stock negativo */}
      {negativeStock.length > 0 && (
        <div className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-500 mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-800 text-sm">
                {negativeStock.length} producto{negativeStock.length > 1 ? 's' : ''} con stock negativo — se deben comprar urgente
              </p>
              <p className="text-xs text-red-600 mt-1">
                Hay órdenes de venta comprometidas que superan el stock disponible. Crea una orden de compra para reponer:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
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
            <button
              onClick={() => { setFilter('negative'); setSearch(''); }}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
            >
              <ShoppingCart size={13} /> Ver todos
            </button>
          </div>
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
              const badge = getStockBadge(product);
              return (
                <div
                  key={product.id}
                  className={`rounded-xl border p-3 ${
                    product.stock < 0 ? 'bg-red-50 border-red-200' :
                    product.stock === 0 ? 'bg-red-50/60 border-red-100' :
                    product.stock <= product.minStock ? 'bg-yellow-50/60 border-yellow-100' :
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
                    <div>
                      <span className={`text-xl font-bold ${product.stock < 0 ? 'text-red-600' : product.stock === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                        {Number(product.stock).toLocaleString('es-CO')}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">{product.unit}</span>
                      <span className="text-xs text-gray-400 ml-2">/ mín {Number(product.minStock).toLocaleString('es-CO')}</span>
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
                  <th className="px-4 py-3 text-center">Stock actual</th>
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
                  const badge = getStockBadge(product);
                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-gray-50 ${
                        product.stock < 0 ? 'bg-red-50' :
                        product.stock === 0 ? 'bg-red-50/40' :
                        product.stock <= product.minStock ? 'bg-yellow-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{product.code}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{product.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{product.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-base ${product.stock < 0 ? 'text-red-600' : product.stock === 0 ? 'text-red-500' : 'text-gray-800'}`}>
                          {Number(product.stock).toLocaleString('es-CO')}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">{product.unit}</span>
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
    </div>
  );
};

export default Inventory;
