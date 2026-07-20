import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Power, PowerOff, LogOut, RefreshCw, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { tenantAdminService, TenantSummary, CreateTenantPayload } from '../services/tenantAdmin';

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  basic: 'Básico',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trial: 'bg-blue-100 text-blue-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

// ---- Create Tenant Form ----

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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-0.5 text-xs text-gray-400">Minúsculas, números y guiones</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre empresa *</label>
          <input
            name="name" value={form.name} onChange={handle} required
            placeholder="Acme Corp"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
          <select
            name="plan" value={form.plan} onChange={handle}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Admin usuario *</label>
          <input
            name="adminUsername" value={form.adminUsername} onChange={handle} required
            placeholder="admin"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Admin contraseña *</label>
          <input
            type="password" name="adminPassword" value={form.adminPassword} onChange={handle} required
            placeholder="mínimo 6 caracteres"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

// ---- Main Page ----

const Superadmin: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTenants(await tenantAdminService.listAll());
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSuspend = async (id: number) => {
    setActionId(id);
    try { await tenantAdminService.suspend(id); await load(); }
    catch (e: unknown) { setError((e as { message?: string })?.message ?? 'Error'); }
    finally { setActionId(null); }
  };

  const handleActivate = async (id: number) => {
    setActionId(id);
    try { await tenantAdminService.activate(id); await load(); }
    catch (e: unknown) { setError((e as { message?: string })?.message ?? 'Error'); }
    finally { setActionId(null); }
  };

  const handleCreate = async (data: CreateTenantPayload) => {
    await tenantAdminService.create(data);
    setShowCreate(false);
    await load();
  };

  const stats = [
    { label: 'Total', value: tenants.length, color: 'text-gray-700' },
    { label: 'Activos', value: tenants.filter(t => t.status === 'active').length, color: 'text-green-600' },
    { label: 'Trial', value: tenants.filter(t => t.status === 'trial').length, color: 'text-blue-600' },
    { label: 'Suspendidos', value: tenants.filter(t => t.status === 'suspended').length, color: 'text-red-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">Merco</p>
              <p className="text-xs text-gray-400 leading-none mt-0.5">Panel superadmin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.username}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Tenants</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              title="Recargar"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreate(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Tenant
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <CreateTenantForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tenant list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay tenants aún</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {['Nombre', 'Slug', 'Plan', 'Estado', 'Trial vence', 'Creado', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tenants.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {t.primaryColor && (
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/10"
                              style={{ backgroundColor: t.primaryColor }}
                            />
                          )}
                          <span className="font-medium text-gray-900 whitespace-nowrap">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-500">{t.slug}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          {PLAN_LABELS[t.plan] ?? t.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString('es-CO') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-4 py-3">
                        {t.status === 'suspended' ? (
                          <button
                            onClick={() => handleActivate(t.id)}
                            disabled={actionId === t.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
                          >
                            <Power className="w-3.5 h-3.5" />
                            Activar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspend(t.id)}
                            disabled={actionId === t.id || t.status === 'cancelled'}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                            Suspender
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Superadmin;
