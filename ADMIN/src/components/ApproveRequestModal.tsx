import React, { useState } from 'react';
import { TenantRequestItem } from '../services/tenantAdmin';

const ApproveRequestModal: React.FC<{
  request: TenantRequestItem;
  onApprove: (data: { slug: string; adminUsername: string; adminPassword: string; plan?: string }) => Promise<void>;
  onClose: () => void;
}> = ({ request, onApprove, onClose }) => {
  const suggestedSlug = request.companyName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  const [slug, setSlug] = useState(suggestedSlug);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [plan, setPlan] = useState('trial');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onApprove({ slug, adminUsername, adminPassword, plan });
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Error al aprobar');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-base font-bold text-gray-900">Aprobar solicitud</h3>
          <p className="text-xs text-gray-400">{request.companyName} · {request.contactName} ({request.email})</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Slug (subdominio) *</label>
          <input value={slug} onChange={e => setSlug(e.target.value)} required pattern="[a-z0-9-]+"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="mt-0.5 text-[11px] text-gray-400">{slug || 'slug'}.merco.edwsystem.com</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Usuario admin *</label>
            <input value={adminUsername} onChange={e => setAdminUsername(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña *</label>
            <input value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="trial">Trial (14 días)</option>
            <option value="basic">Básico</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
            {saving ? 'Creando...' : 'Aprobar y crear tenant'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ApproveRequestModal;
