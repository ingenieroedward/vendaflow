import React, { useEffect, useState } from 'react';
import { ShoppingCart, Truck, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { purchaseOrderService } from '../../services/purchaseOrders';
import { StockMovement } from '../../types';
import LoadingSpinner from '../ui/LoadingSpinner';

const TYPE_META: Record<StockMovement['type'], { label: string; icon: React.ElementType; badge: string }> = {
  sale: { label: 'Venta', icon: ShoppingCart, badge: 'bg-blue-100 text-blue-700' },
  purchase: { label: 'Compra', icon: Truck, badge: 'bg-green-100 text-green-700' },
  adjustment: { label: 'Ajuste', icon: SlidersHorizontal, badge: 'bg-amber-100 text-amber-700' },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const fmtQty = (n: number) => `${n > 0 ? '+' : ''}${Number(n).toLocaleString('es-CO')}`;

// Kardex del tenant: historial de entradas/salidas/ajustes de inventario
const InventoryMovements: React.FC = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (p: number) => {
    setLoading(true);
    try {
      const res = await purchaseOrderService.getStockMovements(p, 50);
      setMovements(prev => (p === 1 ? res.data : [...prev, ...res.data]));
      setHasMore(p < (res.pagination?.totalPages ?? 1));
      setPage(p);
    } catch {
      // la lista queda como esté; el kardex es informativo
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  if (loading && movements.length === 0) {
    return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  }

  if (movements.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
        <p className="text-sm font-medium text-gray-700 mb-1">Aún no hay movimientos</p>
        <p className="text-xs text-gray-500">
          Aquí verás cada entrada y salida de inventario: ventas, compras recibidas y ajustes manuales.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium text-right">Cantidad</th>
              <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Stock</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {movements.map(m => {
              const meta = TYPE_META[m.type];
              const Icon = meta.icon;
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">{fmtDate(m.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900 leading-tight">{m.product?.name ?? `#${m.productId}`}</p>
                    {m.product?.code && <p className="text-[11px] text-gray-400">{m.product.code}</p>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                      <Icon size={11} /> {meta.label}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${Number(m.quantity) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {fmtQty(Number(m.quantity))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 whitespace-nowrap text-xs">
                    {Number(m.stockBefore).toLocaleString('es-CO')} <span className="text-gray-300">→</span>{' '}
                    <span className="font-semibold text-gray-700">{Number(m.stockAfter).toLocaleString('es-CO')}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs hidden md:table-cell max-w-[16rem] truncate">{m.notes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="border-t border-gray-100 p-3 text-center">
          <button
            onClick={() => load(page + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {loading ? <LoadingSpinner size="sm" /> : <ChevronDown size={14} />}
            Cargar más
          </button>
        </div>
      )}
    </div>
  );
};

export default InventoryMovements;
