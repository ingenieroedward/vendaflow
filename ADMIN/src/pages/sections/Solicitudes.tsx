import React, { useState } from 'react';
import { Inbox } from 'lucide-react';
import { tenantAdminService, TenantRequestItem } from '../../services/tenantAdmin';
import ApproveRequestModal from '../../components/ApproveRequestModal';

const Solicitudes: React.FC<{
  requests: TenantRequestItem[];
  onRequestsChange: (r: TenantRequestItem[]) => void;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
}> = ({ requests, onRequestsChange, onReload, onError }) => {
  const [approveReq, setApproveReq] = useState<TenantRequestItem | null>(null);

  const handleApproveRequest = async (data: { slug: string; adminUsername: string; adminPassword: string; plan?: string }) => {
    if (!approveReq) return;
    await tenantAdminService.approveRequest(approveReq.id, data);
    setApproveReq(null);
    await onReload();
  };

  const handleRejectRequest = async (id: number) => {
    try {
      await tenantAdminService.rejectRequest(id);
      onRequestsChange(await tenantAdminService.listRequests());
    } catch (e: unknown) {
      onError((e as { message?: string })?.message ?? 'Error');
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Inbox className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Solicitudes de registro</h3>
        </div>
        {requests.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Sin solicitudes aún — comparte merco.edwsystem.com/registro</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {requests.map(r => (
              <li key={r.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{r.companyName}</p>
                  <p className="text-xs text-gray-500">{r.contactName} · {r.email}{r.phone ? ` · ${r.phone}` : ''}</p>
                  {r.message && <p className="text-xs text-gray-400 mt-0.5 italic truncate">"{r.message}"</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">{new Date(r.createdAt).toLocaleString('es-CO')}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.status === 'pending' ? (
                    <>
                      <button onClick={() => setApproveReq(r)} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">Aprobar</button>
                      <button onClick={() => handleRejectRequest(r.id)} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Rechazar</button>
                    </>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {r.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {approveReq && (
        <ApproveRequestModal request={approveReq} onApprove={handleApproveRequest} onClose={() => setApproveReq(null)} />
      )}
    </>
  );
};

export default Solicitudes;
