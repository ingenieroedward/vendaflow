import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Package, AlertCircle, Truck, ArrowLeft } from 'lucide-react';
import { usePurchaseOrderStore } from '../store/purchaseOrderStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Borrador',  className: 'bg-gray-100 text-gray-700' },
  ordered:   { label: 'Ordenado', className: 'bg-blue-100 text-blue-700' },
  received:  { label: 'Recibido', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado',className: 'bg-red-100 text-red red-700' },
};

const PurchaseOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const { currentPurchaseOrder, loading, error, getById, markAsReceived, update } = usePurchaseOrderStore();
  const [confirming, setConfirming] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id) getById(parseInt(id));
  }, [id, getById]);

  const po = currentPurchaseOrder;

  const handleMarkReceived = async () => {
    if (!po) return;
    setUpdating(true);
    try {
      await markAsReceived(po.id);
      addNotification({
        type: 'success',
        message: po.affectsStock === false
          ? `${po.poNumber} marcada como recibida (sin afectar inventario)`
          : `Stock actualizado — ${po.poNumber} marcada como recibida`,
      });
    } catch {
      addNotification({ type: 'error', message: 'Error al marcar como recibida' });
    }
    setUpdating(false);
    setConfirming(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!po) return;
    setUpdating(true);
    try {
      await update(po.id, { status: newStatus });
      addNotification({ type: 'success', message: `Estado actualizado a "${STATUS_LABELS[newStatus]?.label ?? newStatus}"` });
    } catch {
      addNotification({ type: 'error', message: 'Error al actualizar estado' });
    }
    setUpdating(false);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
        <AlertCircle size={16} /> {error}
      </div>
    </div>
  );
  if (!po) return null;

  const status = STATUS_LABELS[po.status] ?? { label: po.status, className: 'bg-gray-100 text-gray-700' };
  const canReceive = (user?.role === 'admin' || user?.role === 'seller') && po.status !== 'received' && po.status !== 'cancelled';
  const canAdvance = (user?.role === 'admin' || user?.role === 'seller') && po.status === 'draft';

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">{po.poNumber}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
            {po.affectsStock === false && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500" title="Compra registrada solo por costos — el stock ya estaba cargado">
                No suma inventario
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {format(new Date(po.createdAt), "dd MMM yyyy", { locale: es })}
            {po.user && ` · ${po.user.username}`}
          </p>
        </div>
        <button
          onClick={() => navigate('/purchase-orders')}
          className="flex-shrink-0 flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors ml-2"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline text-sm">Volver</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Proveedor */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Proveedor</p>
          <p className="font-semibold text-gray-800">{po.supplier?.name ?? `#${po.supplierId}`}</p>
          {po.supplier?.contact && <p className="text-sm text-gray-500">{po.supplier.contact}</p>}
          {po.supplier?.location && <p className="text-sm text-gray-500">{po.supplier.location}</p>}
        </div>

        {/* Total */}
        <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4">
          <p className="text-xs text-indigo-500 uppercase font-medium mb-1">Total</p>
          <p className="text-2xl font-bold text-indigo-700">${po.totalAmount.toLocaleString('es-CO')}</p>
          <p className="text-sm text-indigo-400">{po.items.length} producto(s)</p>
        </div>

        {/* Notas */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Notas</p>
          <p className="text-sm text-gray-700">{po.notes || 'Sin notas'}</p>
        </div>
      </div>

      {/* Tabla de items */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Package size={16} /> Productos
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-gray-500 border-b">
              <tr>
                <th className="py-2 text-left">Producto</th>
                <th className="py-2 text-center">Cantidad</th>
                <th className="py-2 text-right">Costo unit.</th>
                <th className="py-2 text-right">Total</th>
                {po.status === 'received' && <th className="py-2 text-right">Stock actual</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {po.items.map(item => (
                <tr key={item.id ?? item.productId}>
                  <td className="py-2.5">
                    <div className="font-medium text-gray-800">{item.product?.name ?? `Producto #${item.productId}`}</div>
                    <div className="text-xs text-gray-400">{item.product?.code} · {item.product?.unit}</div>
                  </td>
                  <td className="py-2.5 text-center">{item.quantity}</td>
                  <td className="py-2.5 text-right">${item.unitCost.toLocaleString('es-CO')}</td>
                  <td className="py-2.5 text-right font-medium">${item.totalCost?.toLocaleString('es-CO')}</td>
                  {po.status === 'received' && (
                    <td className="py-2.5 text-right">
                      <span className={`font-medium ${(item.product?.stock ?? 0) <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.product?.stock ?? '—'} {item.product?.unit}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200">
              <tr>
                <td colSpan={po.status === 'received' ? 3 : 3} className="py-2 text-right font-semibold text-gray-700">Total:</td>
                <td className="py-2 text-right font-bold text-indigo-700">${po.totalAmount.toLocaleString('es-CO')}</td>
                {po.status === 'received' && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Acciones */}
      {(canAdvance || canReceive) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Acciones</h2>
          <div className="flex flex-wrap gap-3">
            {canAdvance && (
              <Button
                onClick={() => handleStatusChange('ordered')}
                disabled={updating}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Truck size={15} /> Marcar como Ordenado
              </Button>
            )}
            {canReceive && !confirming && (
              <Button
                onClick={() => setConfirming(true)}
                disabled={updating}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle size={15} /> Marcar como Recibido
              </Button>
            )}
            {confirming && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">¿Confirmar recepción? Esto sumará el stock.</span>
                <Button onClick={handleMarkReceived} disabled={updating} className="bg-green-600 hover:bg-green-700 text-sm">
                  {updating ? 'Procesando...' : 'Sí, recibido'}
                </Button>
                <button onClick={() => setConfirming(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {po.status === 'received' && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle size={16} /> El stock fue actualizado cuando esta orden fue marcada como recibida.
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderDetail;
