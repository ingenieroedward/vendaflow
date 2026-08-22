import React, { useState } from 'react';
import { X } from 'lucide-react';
import { TenantSummary, UpdateTenantPayload, ALL_FEATURES, FEATURE_LABELS } from '../services/tenantAdmin';

interface EditModalProps {
  tenant: TenantSummary;
  onSave: (data: UpdateTenantPayload) => Promise<void>;
  onClose: () => void;
}

const EditTenantModal: React.FC<EditModalProps> = ({ tenant, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: tenant.name,
    plan: tenant.plan,
    trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.substring(0, 10) : '',
    maxUsers: String(tenant.maxUsers),
    maxProducts: String(tenant.maxProducts),
    maxOrdersPerMonth: String(tenant.maxOrdersPerMonth),
    customPrice: tenant.customPrice != null ? String(tenant.customPrice) : '',
    contactName: tenant.contactName ?? '',
    contactEmail: tenant.contactEmail ?? '',
    contactPhone: tenant.contactPhone ?? '',
  });
  // null = usa el default del plan (no override); array = features específicas de este tenant
  const [customFeatures, setCustomFeatures] = useState<string[] | null>(
    tenant.customFeatures ? (JSON.parse(tenant.customFeatures) as string[]) : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSave({
        name: form.name,
        plan: form.plan as UpdateTenantPayload['plan'],
        trialEndsAt: form.trialEndsAt || null,
        maxUsers: parseInt(form.maxUsers, 10),
        maxProducts: parseInt(form.maxProducts, 10),
        maxOrdersPerMonth: parseInt(form.maxOrdersPerMonth, 10),
        customPrice: form.customPrice.trim() === '' ? null : Number(form.customPrice),
        customFeatures,
        contactName: form.contactName.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
      });
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Editar tenant: <span className="font-mono text-blue-600">{tenant.slug}</span></h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre empresa</label>
            <input name="name" value={form.name} onChange={handle} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
              <select name="plan" value={form.plan} onChange={handle}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="trial">Trial</option>
                <option value="basic">Básico</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Trial vence</label>
              <input type="date" name="trialEndsAt" value={form.trialEndsAt} onChange={handle}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max usuarios</label>
              <input type="number" name="maxUsers" value={form.maxUsers} onChange={handle} min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max productos</label>
              <input type="number" name="maxProducts" value={form.maxProducts} onChange={handle} min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Órd/mes</label>
              <input type="number" name="maxOrdersPerMonth" value={form.maxOrdersPerMonth} onChange={handle} min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Precio especial (COP/mes)</label>
            <input type="number" name="customPrice" value={form.customPrice} onChange={handle} min={0}
              placeholder="Vacío = precio de lista del plan"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="mt-0.5 text-[11px] text-gray-400">Descuento o tarifa negociada — es lo que este tenant verá y pagará</p>
          </div>
          <div className="pt-1 border-t border-gray-100">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
              <input
                type="checkbox"
                checked={customFeatures !== null}
                onChange={e => setCustomFeatures(e.target.checked ? [] : null)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Funciones especiales (distintas a su plan)
            </label>
            {customFeatures !== null && (
              <div className="grid grid-cols-2 gap-1.5 pl-6">
                {ALL_FEATURES.map(f => (
                  <label key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={customFeatures.includes(f)}
                      onChange={e => setCustomFeatures(
                        e.target.checked ? [...customFeatures, f] : customFeatures.filter(x => x !== f),
                      )}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {FEATURE_LABELS[f] ?? f}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="pt-1 border-t border-gray-100">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Contacto (avisos de cobro por email y WhatsApp)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                <input name="contactName" value={form.contactName} onChange={handle}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">WhatsApp</label>
                <input name="contactPhone" value={form.contactPhone} onChange={handle} placeholder="57300…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input name="contactEmail" type="email" value={form.contactEmail} onChange={handle}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTenantModal;
