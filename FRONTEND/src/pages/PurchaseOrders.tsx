import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Trash2, Package, AlertCircle } from 'lucide-react';
import { usePurchaseOrderStore } from '../store/purchaseOrderStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { PurchaseOrder } from '../types';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Borrador',  className: 'bg-gray-100 text-gray-700' },
  ordered:   { label: 'Ordenado', className: 'bg-blue-100 text-blue-700' },
  received:  { label: 'Recibido', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado',className: 'bg-red-100 text-red-700' },
};

const PurchaseOrders: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const { purchaseOrders, loading, error, pagination, getAll, remove } = usePurchaseOrderStore();
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => { getAll(1, 50); }, [getAll]);

  const handleDelete = async (po: PurchaseOrder) => {
    try {
      await remove(po.id);
      addNotification({ type: 'success', message: `Orden ${po.poNumber} eliminada` });
    } catch {
      addNotification({ type: 'error', message: 'No se pudo eliminar la orden' });
    }
    setDeleteConfirm(null);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Órdenes de Compra</h1>
          <p className="text-sm text-gray-500 mt-1">{pagination.total} orden(es) registrada(s)</p>
        </div>
        <Button onClick={() => navigate('/purchase-orders/new')} className="flex items-center gap-2">
          <Plus size={16} /> Nueva Orden de Compra
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : purchaseOrders.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>No hay órdenes de compra aún</p>
          <Button onClick={() => navigate('/purchase-orders/new')} className="mt-4">
            Crear primera orden
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">N° Orden</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchaseOrders.map(po => {
                const status = STATUS_LABELS[po.status] ?? { label: po.status, className: 'bg-gray-100 text-gray-700' };
                return (
                  <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{po.poNumber}</td>
                    <td className="px-4 py-3">{po.supplier?.name ?? `Proveedor #${po.supplierId}`}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      ${po.totalAmount.toLocaleString('es-CO')}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {format(new Date(po.createdAt), 'dd MMM yyyy', { locale: es })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600"
                          title="Ver detalle"
                        >
                          <Eye size={15} />
                        </button>
                        {isAdmin && po.status !== 'received' && (
                          deleteConfirm === po.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(po)}
                                className="px-2 py-0.5 bg-red-600 text-white text-xs rounded"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-0.5 bg-gray-200 text-xs rounded"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(po.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-red-500"
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
