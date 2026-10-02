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
  ordered:   { label: 'Ordenado', className: 'bg-primary/15 text-primary' },
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 px-2">Órdenes de compra</h1>
        <p className="text-sm sm:text-lg text-gray-600 px-2">Gestiona las compras a tus proveedores.</p>
      </div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{pagination.total} orden(es)</p>
        <button
          onClick={() => navigate('/purchase-orders/new')}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          <Plus size={13} />
          <span className="hidden sm:inline">Nueva Orden de Compra</span>
          <span className="sm:hidden">Nueva OC</span>
        </button>
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
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-3">
            {purchaseOrders.map(po => {
              const status = STATUS_LABELS[po.status] ?? { label: po.status, className: 'bg-gray-100 text-gray-700' };
              return (
                <div key={po.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-mono font-semibold text-indigo-700 text-sm">{po.poNumber}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{format(new Date(po.createdAt), 'dd MMM yyyy', { locale: es })}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{po.supplier?.name ?? `Proveedor #${po.supplierId}`}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-gray-900">${po.totalAmount.toLocaleString('es-CO')}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium"
                      >
                        <Eye size={13} /> Ver
                      </button>
                      {isAdmin && po.status !== 'received' && (
                        deleteConfirm === po.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(po)} className="px-2 py-1.5 bg-red-600 text-white text-xs rounded-lg">Confirmar</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1.5 bg-gray-200 text-xs rounded-lg">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(po.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                            <Trash2 size={15} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: tabla */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
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
                      <td className="px-4 py-3 text-right font-medium">${po.totalAmount.toLocaleString('es-CO')}</td>
                      <td className="px-4 py-3 text-gray-500">{format(new Date(po.createdAt), 'dd MMM yyyy', { locale: es })}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => navigate(`/purchase-orders/${po.id}`)} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600" title="Ver detalle">
                            <Eye size={15} />
                          </button>
                          {isAdmin && po.status !== 'received' && (
                            deleteConfirm === po.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDelete(po)} className="px-2 py-0.5 bg-red-600 text-white text-xs rounded">Confirmar</button>
                                <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 bg-gray-200 text-xs rounded">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirm(po.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Eliminar">
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
        </>
      )}
    </div>
  );
};

export default PurchaseOrders;
