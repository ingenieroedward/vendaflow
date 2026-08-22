import React, { useState } from 'react';
import { Receipt, FileText, Check, X } from 'lucide-react';
import { tenantAdminService, PlanPaymentItem } from '../../services/tenantAdmin';

// Cola de aprobación de pagos reportados por los tenants (comprobante Bre-B).
// Vive dentro de Bandeja junto a Solicitudes — son las dos bandejas de "algo
// espera mi decisión hoy". La configuración de pagos (llave/precios/features)
// y el histórico ya no están aquí, ver Configuracion.tsx.
const ColaPagos: React.FC<{
  payments: PlanPaymentItem[];
  onPaymentsChange: (p: PlanPaymentItem[]) => void;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
}> = ({ payments, onPaymentsChange, onReload, onError }) => {
  const [receiptView, setReceiptView] = useState<{ payment: PlanPaymentItem; src: string | null } | null>(null);

  const handleViewReceipt = async (payment: PlanPaymentItem) => {
    try {
      const r = await tenantAdminService.getPaymentReceipt(payment.id);
      setReceiptView({ payment, src: r.receiptBase64 ? `data:${r.receiptMime ?? 'image/jpeg'};base64,${r.receiptBase64}` : null });
    } catch (e: unknown) { onError((e as { message?: string })?.message ?? 'Error'); }
  };

  const handleDecidePayment = async (id: number, approve: boolean) => {
    try {
      if (approve) await tenantAdminService.approvePayment(id);
      else await tenantAdminService.rejectPayment(id, prompt('Motivo del rechazo (opcional):') ?? undefined);
      setReceiptView(null);
      await onReload();
      onPaymentsChange(await tenantAdminService.listPayments());
    } catch (e: unknown) { onError((e as { message?: string })?.message ?? 'Error'); }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Pagos de planes (Bre-B)</h3>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Sin pagos reportados aún</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {payments.map(pg => (
              <li key={pg.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {pg.tenant?.name ?? `Tenant #${pg.tenantId}`}
                    <span className="ml-2 font-normal text-gray-500">plan {pg.plan}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(pg.amount))}
                    {pg.reference ? ` · ref ${pg.reference}` : ''} · {new Date(pg.createdAt).toLocaleString('es-CO')}
                  </p>
                  {pg.receiptNumber && (
                    <p className="text-[11px] text-green-600 font-medium">
                      Recibo {pg.receiptNumber}
                      {pg.receiptUrl && (
                        <a href={pg.receiptUrl} target="_blank" rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-0.5 text-blue-600 hover:underline font-semibold">
                          <FileText className="w-3 h-3" /> Ver recibo
                        </a>
                      )}
                    </p>
                  )}
                  {pg.rejectReason && <p className="text-[11px] text-red-500">Rechazado: {pg.rejectReason}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pg.receiptMime && (
                    <button onClick={() => handleViewReceipt(pg)} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Comprobante</button>
                  )}
                  {pg.status === 'pending' ? (
                    <>
                      <button onClick={() => handleDecidePayment(pg.id, true)} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">Aprobar</button>
                      <button onClick={() => handleDecidePayment(pg.id, false)} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Rechazar</button>
                    </>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pg.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {pg.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {receiptView && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setReceiptView(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">
                Comprobante — {receiptView.payment.tenant?.name} ({new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(receiptView.payment.amount))})
              </p>
              <button onClick={() => setReceiptView(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            {receiptView.src ? (
              <img src={receiptView.src} alt="Comprobante de pago" className="w-full rounded-lg border border-gray-200" />
            ) : (
              <p className="text-sm text-gray-400 py-8 text-center">Sin comprobante adjunto</p>
            )}
            {receiptView.payment.status === 'pending' && (
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => handleDecidePayment(receiptView.payment.id, false)} className="px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Rechazar</button>
                <button onClick={() => handleDecidePayment(receiptView.payment.id, true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                  <Check className="w-3.5 h-3.5" /> Aprobar pago
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ColaPagos;
