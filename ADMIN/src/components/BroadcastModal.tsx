import React, { useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { tenantAdminService, TenantSummary } from '../services/tenantAdmin';

const BroadcastModal: React.FC<{
  tenants: TenantSummary[];
  onClose: () => void;
  onSent: (recipients: number) => void;
}> = ({ tenants, onClose, onSent }) => {
  const [tenantId, setTenantId] = useState<string>('');
  const [onlyAdmins, setOnlyAdmins] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const r = await tenantAdminService.broadcast({
        ...(tenantId ? { tenantId: Number(tenantId) } : {}),
        onlyAdmins,
        title,
        body,
      });
      onSent(r.recipients);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'No se pudo enviar');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={send} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-gray-400" /> Anuncio push
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Destinatario</label>
          <select
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Toda la plataforma</option>
            {tenants.filter(t => t.slug !== 'platform').map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input type="checkbox" checked={onlyAdmins} onChange={e => setOnlyAdmins(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
          Solo administradores
        </label>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
          <input
            value={title} onChange={e => setTitle(e.target.value)} required maxLength={80}
            placeholder="Mantenimiento programado"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Mensaje *</label>
          <textarea
            value={body} onChange={e => setBody(e.target.value)} required rows={3} maxLength={300}
            placeholder="El domingo 3 de agosto de 2 a 3 AM la plataforma estará en mantenimiento..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <p className="text-[11px] text-gray-400">
          Solo llega a usuarios con notificaciones push activadas en la app.
        </p>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button type="submit" disabled={sending} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BroadcastModal;
