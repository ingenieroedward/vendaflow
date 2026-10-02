import React, { useMemo, useState } from 'react';
import { Search, RefreshCw, Megaphone, Plus, Building2, ExternalLink, AlertTriangle, DollarSign, Eye, LogIn, Edit, Power, PowerOff, XCircle, Trash2 } from 'lucide-react';
import { tenantAdminService, TenantSummary, CreateTenantPayload, UpdateTenantPayload, TenantDetail } from '../../services/tenantAdmin';
import { PLAN_LABELS, STATUS_STYLE, STATUS_LABELS, daysUntil, tenantAppUrl } from '../../utils/adminHelpers';
import UsagePill from '../../components/UsagePill';
import CreateTenantForm from '../../components/CreateTenantForm';
import EditTenantModal from '../../components/EditTenantModal';
import TenantDetailModal from '../../components/TenantDetailModal';

const Tenants: React.FC<{
  tenants: TenantSummary[];
  loading: boolean;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
  onShowBroadcast: () => void;
  onPayTenant: (t: TenantSummary) => void;
}> = ({ tenants, loading, onReload, onError, onShowBroadcast, onPayTenant }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantSummary | null>(null);
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tenants.filter(t => {
      const matchSearch = !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tenants, search, statusFilter]);

  const handleCreate = async (data: CreateTenantPayload) => {
    await tenantAdminService.create(data);
    setShowCreate(false);
    await onReload();
  };

  const handleEdit = async (data: UpdateTenantPayload) => {
    if (!editTenant) return;
    await tenantAdminService.update(editTenant.id, data);
    setEditTenant(null);
    await onReload();
  };

  const handleExtendTrial = async (t: TenantSummary, days: number) => {
    try {
      const base = t.trialEndsAt && new Date(t.trialEndsAt) > new Date() ? new Date(t.trialEndsAt) : new Date();
      base.setDate(base.getDate() + days);
      await tenantAdminService.update(t.id, { trialEndsAt: base.toISOString().slice(0, 10) });
      await onReload();
    } catch (e: unknown) {
      onError((e as { message?: string })?.message ?? 'No se pudo extender el trial');
    }
  };

  const handleOpenDetail = async (t: TenantSummary) => {
    setDetailLoading(true);
    try {
      setDetail(await tenantAdminService.getDetail(t.id));
    } catch (e: unknown) {
      onError((e as { message?: string })?.message ?? 'No se pudo cargar el detalle');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleImpersonate = async (t: TenantSummary) => {
    // Abrir la pestaña DENTRO del gesto del usuario (síncrono) — si se abre
    // después del await, el bloqueador de popups la mata sin error visible
    const win = window.open('', '_blank');
    try {
      const r = await tenantAdminService.impersonate(t.id);
      const url = `${tenantAppUrl(r.slug)}/login?impersonate=${encodeURIComponent(r.token)}`;
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (e: unknown) {
      win?.close();
      onError((e as { message?: string })?.message ?? 'No se pudo impersonar');
    }
  };

  const handleExport = async (id: number, slug: string) => {
    try {
      const data = await tenantAdminService.exportData(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenant-${slug}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      onError((e as { message?: string })?.message ?? 'No se pudo exportar');
    }
  };

  const handleSuspend = async (id: number) => {
    setActionId(id);
    try { await tenantAdminService.suspend(id); await onReload(); }
    catch (e: unknown) { onError((e as { message?: string })?.message ?? 'Error'); }
    finally { setActionId(null); }
  };

  const handleActivate = async (id: number) => {
    setActionId(id);
    try { await tenantAdminService.activate(id); await onReload(); }
    catch (e: unknown) { onError((e as { message?: string })?.message ?? 'Error'); }
    finally { setActionId(null); }
  };

  const handleCancelTenant = async (t: TenantSummary) => {
    if (!window.confirm(`¿Cancelar el tenant "${t.name}"?\n\nQueda bloqueado y sus datos se conservan 90 días por si vuelve. Puedes exportar antes desde el detalle.`)) return;
    setActionId(t.id);
    try { await tenantAdminService.cancelTenant(t.id); await onReload(); }
    catch (e: unknown) { onError((e as { message?: string })?.message ?? 'Error'); }
    finally { setActionId(null); }
  };

  const handlePurgeTenant = async (t: TenantSummary) => {
    if (!window.confirm(`⚠ PURGAR "${t.name}" — IRREVERSIBLE\n\nBorra usuarios, productos, clientes, órdenes y todo su inventario. Se conserva solo el histórico de pagos.\n\n¿Continuar?`)) return;
    if (!window.confirm(`Última confirmación: escribe mentalmente "${t.slug}" y confirma que exportaste sus datos si los necesitas.`)) return;
    setActionId(t.id);
    try { await tenantAdminService.purgeTenant(t.id); await onReload(); }
    catch (e: unknown) { onError((e as { message?: string })?.message ?? 'Error'); }
    finally { setActionId(null); }
  };

  return (
    <>
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
            onClick={onReload}
            title="Recargar"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onShowBroadcast}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Enviar anuncio push"
          >
            <Megaphone className="w-4 h-4" />
            <span className="hidden sm:inline">Anuncio</span>
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
                  {['Nombre / URL', 'Slug', 'Plan', 'Estado', 'Trial vence', 'Uso', 'Creado', ''].map(h => (
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
                            {t.plan === 'trial' && (
                              <button
                                onClick={() => handleExtendTrial(t, 7)}
                                className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                                title="Extender trial 7 días (reactiva si está suspendido)"
                              >
                                +7d
                              </button>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {t.usage ? (
                          <span className="text-gray-400">
                            <UsagePill used={t.usage.users} max={t.maxUsers} title="Usuarios" />u
                            {' · '}
                            <UsagePill used={t.usage.products} max={t.maxProducts} title="Productos" />p
                            {' · '}
                            <UsagePill used={t.usage.ordersThisMonth} max={t.maxOrdersPerMonth} title="Órdenes este mes" />o
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            {t.maxUsers}u · {t.maxProducts}p · {t.maxOrdersPerMonth}o
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {t.slug !== 'platform' && (
                            <button
                              onClick={() => onPayTenant(t)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Registrar pago"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDetail(t)}
                            disabled={detailLoading}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-40"
                            title="Ver detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {t.slug !== 'platform' && (
                            <button
                              onClick={() => handleImpersonate(t)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Entrar como admin del tenant"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setEditTenant(t)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {t.status === 'suspended' || t.status === 'cancelled' ? (
                            <button
                              onClick={() => handleActivate(t.id)}
                              disabled={actionId === t.id}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
                              title="Reactivar tenant"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSuspend(t.id)}
                              disabled={actionId === t.id}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                              title="Suspender tenant"
                            >
                              <PowerOff className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {t.status !== 'cancelled' && t.slug !== 'demo' && t.slug !== 'platform' && (
                            <button
                              onClick={() => handleCancelTenant(t)}
                              disabled={actionId === t.id}
                              className="p-1.5 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-40"
                              title="Cancelar tenant (offboarding — datos 90 días)"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {t.status === 'cancelled' && (
                            <button
                              onClick={() => handlePurgeTenant(t)}
                              disabled={actionId === t.id}
                              className="p-1.5 text-gray-300 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                              title="Purgar datos (irreversible)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {editTenant && (
        <EditTenantModal tenant={editTenant} onSave={handleEdit} onClose={() => setEditTenant(null)} />
      )}

      {detail && (
        <TenantDetailModal
          detail={detail}
          onClose={() => setDetail(null)}
          onExport={handleExport}
          onImpersonate={handleImpersonate}
        />
      )}
    </>
  );
};

export default Tenants;
