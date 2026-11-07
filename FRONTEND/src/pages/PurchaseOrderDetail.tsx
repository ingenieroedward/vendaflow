import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Package, AlertCircle, Truck } from 'lucide-react';
import { usePurchaseOrderStore } from '../store/purchaseOrderStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Borrador',  className: 'bg-gray-100 text-gray-700' },
  ordered:   { label: 'Ordenado', className: 'bg-primary/15 text-primary' },
  received:  { label: 'Recibido', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado',className: 'bg-red-100 text-red red-700' },
};

const PurchaseOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
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

  const money = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));

  return (
    <div className="bg-gray-50 min-h-full">
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
      <Breadcrumbs items={[{ label: 'Órdenes de compra', to: '/purchase-orders' }, { label: po.poNumber }]} />

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[12rem]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-mono">{po.poNumber}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>{status.label}</span>
            {po.affectsStock === false && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700" title="Compra registrada solo por costos — el stock ya estaba cargado">
                No suma inventario
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5">
            {format(new Date(po.createdAt), "dd MMM yyyy", { locale: es })}
            {po.user && ` · ${po.user.username}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <section className="bg-white rounded-xl border border-gray-200 min-w-0" aria-labelledby="pod-items">
          <h2 id="pod-items" className="px-4 pt-4 pb-2 text-base font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-500" aria-hidden="true" /> Productos
            <span className="text-sm font-normal text-gray-600">({po.items.length})</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-2">Producto</th>
                  <th scope="col" className="px-4 py-2 text-right">Cant.</th>
                  <th scope="col" className="px-4 py-2 text-right">Costo unit.</th>
                  <th scope="col" className="px-4 py-2 text-right">Total</th>
                  {po.status === 'received' && <th scope="col" className="px-4 py-2 text-right">Stock actual</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {po.items.map(item => (
                  <tr key={item.id ?? item.productId}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{item.product?.name ?? `Producto #${item.productId}`}</p>
                      <p className="text-xs text-gray-600"><span className="font-mono">{item.product?.code}</span> · {item.product?.unit}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{Number(item.quantity)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(item.unitCost)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">{money(Number(item.totalCost ?? item.quantity * item.unitCost))}</td>
                    {po.status === 'received' && (
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-800">
                        {item.product?.stock ?? '—'} {item.product?.unit}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex justify-between text-base font-bold text-gray-900">
            <span>Total</span><span className="tabular-nums">{money(po.totalAmount)}</span>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4" aria-labelledby="pod-total">
            <h2 id="pod-total" className="text-xs font-medium text-gray-600">Total de la compra</h2>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{money(po.totalAmount)}</p>

            {canAdvance && (
              <Button
                variant="outline"
                icon={Truck}
                onClick={() => handleStatusChange('ordered')}
                disabled={updating}
                className="mt-3 w-full min-h-[44px]"
              >
                Marcar como pedida al proveedor
              </Button>
            )}
            {canReceive && !confirming && (
              <button
                onClick={() => setConfirming(true)}
                disabled={updating}
                className="mt-2 w-full flex items-center justify-center gap-1.5 min-h-[44px] px-3 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" aria-hidden="true" /> Marcar como recibida
              </button>
            )}
            {confirming && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3" role="alertdialog" aria-label="Confirmar recepción">
                <p className="text-sm text-green-900">
                  {po.affectsStock === false
                    ? '¿Confirmar recepción? Esta compra no suma inventario (solo registra el costo).'
                    : '¿Confirmar recepción? Se sumarán las cantidades al inventario.'}
                </p>
                <div className="mt-2 flex gap-2">
                  <button onClick={handleMarkReceived} disabled={updating} className="min-h-[40px] px-3 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50">
                    {updating ? 'Procesando…' : 'Sí, recibida'}
                  </button>
                  <button onClick={() => setConfirming(false)} className="min-h-[40px] px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-800 hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {po.status === 'received' && (
              <p className="mt-3 flex items-start gap-2 text-sm text-green-900">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                {po.affectsStock === false ? 'Recibida (no sumó inventario).' : 'Recibida: el stock se actualizó al marcarla.'}
              </p>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-xs font-medium text-gray-600 mb-1">Proveedor</h2>
            <p className="font-semibold text-gray-900">{po.supplier?.name ?? `#${po.supplierId}`}</p>
            {po.supplier?.contact && <p className="text-sm text-gray-700">{po.supplier.contact}</p>}
            {po.supplier?.location && <p className="text-sm text-gray-700">{po.supplier.location}</p>}
          </section>

          {po.notes && (
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-xs font-medium text-gray-600 mb-1">Notas</h2>
              <p className="text-sm text-gray-800 whitespace-pre-line">{po.notes}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
    </div>
  );
};

export default PurchaseOrderDetail;
