import React from 'react';
import { TenantRequestItem, PlanPaymentItem } from '../../services/tenantAdmin';
import Solicitudes from './Solicitudes';
import ColaPagos from './ColaPagos';

// "Qué necesito decidir hoy" — fusiona Solicitudes de registro y la cola de
// aprobación de pagos, que antes eran dos ítems de menú separados con dos
// badges de colores distintos aunque son el mismo tipo de bandeja de entrada.
const Bandeja: React.FC<{
  requests: TenantRequestItem[];
  onRequestsChange: (r: TenantRequestItem[]) => void;
  payments: PlanPaymentItem[];
  onPaymentsChange: (p: PlanPaymentItem[]) => void;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
}> = ({ requests, onRequestsChange, payments, onPaymentsChange, onReload, onError }) => {
  return (
    <div className="space-y-6">
      <Solicitudes requests={requests} onRequestsChange={onRequestsChange} onReload={onReload} onError={onError} />
      <ColaPagos payments={payments} onPaymentsChange={onPaymentsChange} onReload={onReload} onError={onError} />
    </div>
  );
};

export default Bandeja;
