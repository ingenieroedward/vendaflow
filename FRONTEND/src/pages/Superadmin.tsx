import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Power, PowerOff, LogOut, RefreshCw, X, Search, ExternalLink, Edit, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { tenantAdminService, TenantSummary, CreateTenantPayload, UpdateTenantPayload } from '../services/tenantAdmin';

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

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  trial: 'Trial',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
};

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function tenantAppUrl(slug: string): string {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    const base = parts.slice(-2).join('.');
    return `https://${slug}.${base}`;
  }
  return `https://${slug}.merco.edwsystem.com`;
}

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

// ---- Edit Tenant Modal ----

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
      await onSave({
        name: form.name,
        plan: form.plan as UpdateTenantPayload['plan'],
        trialEndsAt: form.trialEndsAt || null,
        maxUsers: parseInt(form.maxUsers, 10),
        maxProducts: parseInt(form.maxProducts, 10),
        maxOrdersPerMonth: parseInt(form.maxOrdersPerMonth, 10),
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

// ---- Main Page ----

const Superadmin: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editTenant, setEditTenant] = useState<TenantSummary | null>(null);

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

  const handleEdit = async (data: UpdateTenantPayload) => {
    if (!editTenant) return;
    await tenantAdminService.update(editTenant.id, data);
    setEditTenant(null);
    await load();
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tenants.filter(t => {
      const matchSearch = !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tenants, search, statusFilter]);

  const stats = [
    { label: 'Total', value: tenants.length, color: 'text-gray-700' },
    { label: 'Activos', value: tenants.filter(t => t.status === 'active').length, color: 'text-green-600' },
    { label: 'Trial', value: tenants.filter(t => t.status === 'trial').length, color: 'text-blue-600' },
    { label: 'Suspendidos', value: tenants.filter(t => t.status === 'suspended').length, color: 'text-red-600' },
  ];

  const expiringTenants = tenants.filter(t => t.trialEndsAt && daysUntil(t.trialEndsAt) <= 7 && t.status === 'trial');

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

        {/* Trial expiry alerts */}
        {expiringTenants.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">
                  {expiringTenants.length} trial{expiringTenants.length !== 1 ? 's' : ''} expiran pronto
                </p>
                <div className="space-y-0.5">
                  {expiringTenants.map(t => {
                    const days = daysUntil(t.trialEndsAt!);
                    return (
                      <p key={t.id} className="text-xs text-amber-700">
                        <span className="font-medium">{t.name}</span>
                        {' — '}
                        {days <= 0 ? 'expiró' : days === 1 ? 'vence mañana' : `vence en ${days} días`}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre o slug..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspendidos</option>
            <option value="cancelled">Cancelados</option>
          </select>
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
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
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{tenants.length === 0 ? 'No hay tenants aún' : 'Sin resultados'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {['Nombre / URL', 'Slug', 'Plan', 'Estado', 'Trial vence', 'Límites', 'Creado', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(t => {
                    const trialDays = t.trialEndsAt ? daysUntil(t.trialEndsAt) : null;
                    const trialUrgent = trialDays !== null && trialDays <= 7 && t.status === 'trial';
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {t.primaryColor && (
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/10"
                                style={{ backgroundColor: t.primaryColor }}
                              />
                            )}
                            <div>
                              <span className="font-medium text-gray-900 whitespace-nowrap">{t.name}</span>
                              <a
                                href={tenantAppUrl(t.slug)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Abrir app
                              </a>
                            </div>
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
                            {STATUS_LABELS[t.status] ?? t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {t.trialEndsAt ? (
                            <span className={`text-xs whitespace-nowrap font-medium ${trialUrgent ? 'text-red-600' : 'text-gray-500'}`}>
                              {trialUrgent && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                              {new Date(t.trialEndsAt).toLocaleDateString('es-CO')}
                              {trialDays !== null && (
                                <span className="ml-1 text-gray-400">
                                  ({trialDays <= 0 ? 'expiró' : `${trialDays}d`})
                                </span>
                              )}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {t.maxUsers}u · {t.maxProducts}p · {t.maxOrdersPerMonth}o
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleDateString('es-CO')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditTenant(t)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length !== tenants.length && (
              <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
                Mostrando {filtered.length} de {tenants.length} tenants
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editTenant && (
        <EditTenantModal
          tenant={editTenant}
          onSave={handleEdit}
          onClose={() => setEditTenant(null)}
        />
      )}
    </div>
  );
};

export default Superadmin;
