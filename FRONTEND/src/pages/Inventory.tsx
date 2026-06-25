import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Package, TrendingDown, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProductStore } from '../store/productStore';
import { usePurchaseOrderStore } from '../store/purchaseOrderStore';
import { Product } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Button from '../components/ui/Button';

type FilterType = 'all' | 'alerts' | 'out_of_stock';

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

  // Reset page when search/filter changes
  useEffect(() => { setPage(1); }, [search, filter]);

  const filtered = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'out_of_stock') return p.stock <= 0;
    if (filter === 'alerts') return p.stock > 0 && p.stock <= p.minStock;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const outOfStock = products.filter(p => p.stock <= 0).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;

  const getStockBadge = (product: Product) => {
    if (product.stock <= 0) return { label: 'Sin stock', className: 'bg-red-100 text-red-700' };
    if (product.stock <= product.minStock) return { label: 'Stock bajo', className: 'bg-yellow-100 text-yellow-700' };
    return { label: 'OK', className: 'bg-green-100 text-green-700' };
  };

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

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Package className="text-indigo-500" size={24} />
            <div>
              <p className="text-2xl font-bold text-gray-900">{products.length}</p>
              <p className="text-sm text-gray-500">Productos totales</p>
            </div>
          </div>
        </div>
        <div
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${outOfStock > 0 ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-white border-gray-200'}`}
          onClick={() => setFilter(filter === 'out_of_stock' ? 'all' : 'out_of_stock')}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className={outOfStock > 0 ? 'text-red-500' : 'text-gray-400'} size={24} />
            <div>
              <p className={`text-2xl font-bold ${outOfStock > 0 ? 'text-red-700' : 'text-gray-900'}`}>{outOfStock}</p>
              <p className="text-sm text-gray-500">Sin stock</p>
            </div>
          </div>
        </div>
        <div
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${lowStock > 0 ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' : 'bg-white border-gray-200'}`}
          onClick={() => setFilter(filter === 'alerts' ? 'all' : 'alerts')}
        >
          <div className="flex items-center gap-3">
            <TrendingDown className={lowStock > 0 ? 'text-yellow-500' : 'text-gray-400'} size={24} />
            <div>
              <p className={`text-2xl font-bold ${lowStock > 0 ? 'text-yellow-700' : 'text-gray-900'}`}>{lowStock}</p>
              <p className="text-sm text-gray-500">Stock bajo mínimo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'alerts', 'out_of_stock'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'alerts' ? 'Stock bajo' : 'Sin stock'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
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
                    <tr key={product.id} className={`hover:bg-gray-50 ${product.stock <= 0 ? 'bg-red-50/40' : product.stock > 0 && product.stock <= product.minStock ? 'bg-yellow-50/40' : ''}`}>
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
                      <td className="px-4 py-3 text-right">
                        ${Number(product.salePrice).toLocaleString('es-CO')}
                      </td>
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
