import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CreateTenantPayload } from '../services/tenantAdmin';

interface CreateFormProps {
  onSubmit: (data: CreateTenantPayload) => Promise<void>;
  onCancel: () => void;
}

const CreateTenantForm: React.FC<CreateFormProps> = ({ onSubmit, onCancel }) => {
  const [form, setForm] = useState<CreateTenantPayload>({
    slug: '',
    name: '',
    plan: 'trial',
    adminUsername: '',
    adminPassword: '',
    primaryColor: '#2563eb',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Error al crear tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900">Nuevo Tenant</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Slug *</label>
          <input
            name="slug" value={form.slug} onChange={handle} required
            placeholder="acme-corp"
            pattern="[a-z0-9-]+"
            title="Solo minúsculas, números y guiones"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-0.5 text-xs text-gray-400">Minúsculas, números y guiones</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre empresa *</label>
          <input
            name="name" value={form.name} onChange={handle} required
            placeholder="Acme Corp"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
          <select
            name="plan" value={form.plan} onChange={handle}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="trial">Trial (14 días)</option>
            <option value="basic">Básico</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Color primario</label>
          <div className="flex items-center gap-2">
            <input
              type="color" name="primaryColor" value={form.primaryColor} onChange={handle}
              className="h-9 w-12 rounded border border-gray-300 cursor-pointer p-0.5 flex-shrink-0"
            />
            <input
              name="primaryColor" value={form.primaryColor} onChange={handle}
              placeholder="#2563eb"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Admin usuario *</label>
          <input
            name="adminUsername" value={form.adminUsername} onChange={handle} required
            placeholder="admin"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Admin contraseña *</label>
          <input
            type="password" name="adminPassword" value={form.adminPassword} onChange={handle} required
            placeholder="mínimo 6 caracteres"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button" onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit" disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear Tenant'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateTenantForm;
