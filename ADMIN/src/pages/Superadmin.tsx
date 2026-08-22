import React, { useState, useEffect, useCallback } from 'react';
import { Building2, LogOut, X, Megaphone, LayoutDashboard, Inbox, Receipt, Bell, BellOff, Wallet, ScrollText } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { tenantAdminService, TenantSummary, TenantRequestItem, PlanPaymentItem, FinanceData, AuditLogItem, PlatformSettings, PlatformStats } from '../services/tenantAdmin';
import BroadcastModal from '../components/BroadcastModal';
import RegisterPaymentModal from '../components/RegisterPaymentModal';
import Dashboard from './sections/Dashboard';
import Tenants from './sections/Tenants';
import Solicitudes from './sections/Solicitudes';
import Pagos from './sections/Pagos';
import Finanzas from './sections/Finanzas';
import Auditoria from './sections/Auditoria';

interface FunnelData {
  days: number;
  landingViews: number;
  registroViews: number;
  requests: number;
  approved: number;
}

const Superadmin: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastOk, setBroadcastOk] = useState<string | null>(null);
  const [section, setSection] = useState<'dashboard' | 'tenants' | 'solicitudes' | 'pagos' | 'finanzas' | 'auditoria'>('dashboard');
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [payTenant, setPayTenant] = useState<TenantSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, toggle: togglePush } = usePushNotifications();
  const [requests, setRequests] = useState<TenantRequestItem[]>([]);
  const [payments, setPayments] = useState<PlanPaymentItem[]>([]);
  const [payCfg, setPayCfg] = useState<PlatformSettings | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [platform, setPlatform] = useState<PlatformStats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTenants(await tenantAdminService.listAll());
      tenantAdminService.platformStats().then(setPlatform).catch(() => setPlatform(null));
      tenantAdminService.listRequests().then(setRequests).catch(() => setRequests([]));
      tenantAdminService.listPayments().then(setPayments).catch(() => setPayments([]));
      tenantAdminService.getPlatformSettings().then(setPayCfg).catch(() => setPayCfg(null));
      tenantAdminService.getFunnel().then(setFunnel).catch(() => setFunnel(null));
      tenantAdminService.getFinance().then(setFinance).catch(() => setFinance(null));
      tenantAdminService.listAudit().then(setAuditLogs).catch(() => setAuditLogs([]));
      tenantAdminService.totpStatus().then(r => setTotpEnabled(r.enabled)).catch(() => setTotpEnabled(null));
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pendingPayments = payments.filter(p => p.status === 'pending');

  const navCls = (active: boolean) =>
    `flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar — dark to signal elevated infrastructure context */}
      <aside className="hidden md:flex md:flex-col w-60 bg-slate-900 fixed inset-y-0 left-0 z-20">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10 flex-shrink-0">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Merco</p>
            <p className="text-xs text-slate-400 leading-none mt-0.5">Superadmin</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button onClick={() => setSection('dashboard')} className={navCls(section === 'dashboard')}>
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Dashboard
          </button>
          <button onClick={() => setSection('tenants')} className={navCls(section === 'tenants')}>
            <Building2 className="w-4 h-4 flex-shrink-0" /> Tenants
            <span className="ml-auto text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{tenants.length}</span>
          </button>
          <button onClick={() => setSection('solicitudes')} className={navCls(section === 'solicitudes')}>
            <Inbox className="w-4 h-4 flex-shrink-0" /> Solicitudes
            {pendingRequests.length > 0 && (
              <span className="ml-auto text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>
            )}
          </button>
          <button onClick={() => setSection('pagos')} className={navCls(section === 'pagos')}>
            <Receipt className="w-4 h-4 flex-shrink-0" /> Pagos
            {pendingPayments.length > 0 && (
              <span className="ml-auto text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">{pendingPayments.length}</span>
            )}
          </button>
          <button onClick={() => setSection('finanzas')} className={navCls(section === 'finanzas')}>
            <Wallet className="w-4 h-4 flex-shrink-0" /> Finanzas
            {finance && finance.overdue.length > 0 && (
              <span className="ml-auto text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{finance.overdue.length}</span>
            )}
          </button>
          <button onClick={() => setSection('auditoria')} className={navCls(section === 'auditoria')}>
            <ScrollText className="w-4 h-4 flex-shrink-0" /> Auditoría
          </button>
          <button onClick={() => setShowBroadcast(true)} className={navCls(false)}>
            <Megaphone className="w-4 h-4 flex-shrink-0" /> Anuncio
          </button>
        </nav>
        <div className="px-3 py-4 border-t border-white/10 flex-shrink-0">
          {pushSupported && (
            <button
              onClick={togglePush}
              disabled={pushLoading}
              className="flex items-center gap-2.5 w-full px-3 py-2 mb-1 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              title={pushSubscribed ? 'Desactivar notificaciones' : 'Activar notificaciones (pagos, solicitudes, trials)'}
            >
              {pushSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              <span className="flex-1 text-left">Notificaciones</span>
              <span className={`w-2 h-2 rounded-full ${pushSubscribed ? 'bg-green-500' : 'bg-slate-600'}`} />
            </button>
          )}
          <p className="px-3 text-xs text-slate-400 mb-2 truncate">{user?.username}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </aside>

      {/* Barra superior móvil */}
      <header className="md:hidden bg-slate-900 sticky top-0 z-20 px-4 h-14 flex items-center justify-between">
        <p className="text-sm font-bold text-white">Merco · Superadmin</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setSection('dashboard')} className={`p-2 rounded-lg ${section === 'dashboard' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
            <LayoutDashboard className="w-4 h-4" />
          </button>
          <button onClick={() => setSection('tenants')} className={`p-2 rounded-lg ${section === 'tenants' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
            <Building2 className="w-4 h-4" />
          </button>
          <button onClick={() => setSection('solicitudes')} className={`relative p-2 rounded-lg ${section === 'solicitudes' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
            <Inbox className="w-4 h-4" />
            {pendingRequests.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />}
          </button>
          <button onClick={() => setSection('pagos')} className={`relative p-2 rounded-lg ${section === 'pagos' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
            <Receipt className="w-4 h-4" />
            {pendingPayments.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />}
          </button>
          <button onClick={() => setSection('finanzas')} className={`relative p-2 rounded-lg ${section === 'finanzas' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
            <Wallet className="w-5 h-5" />
            {finance && finance.overdue.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          {pushSupported && (
            <button onClick={togglePush} disabled={pushLoading} className={`p-2 rounded-lg ${pushSubscribed ? 'text-green-400' : 'text-slate-300'}`}>
              {pushSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          )}
          <button onClick={handleLogout} className="p-2 rounded-lg text-red-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="md:ml-60 px-4 sm:px-6 lg:px-8 py-6 space-y-6 min-w-0">
        {broadcastOk && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
            {broadcastOk}
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {section === 'auditoria' && <Auditoria auditLogs={auditLogs} />}

        {section === 'finanzas' && (
          <Finanzas finance={finance} tenants={tenants} onPayTenant={setPayTenant} />
        )}

        {section === 'dashboard' && (
          <Dashboard tenants={tenants} platform={platform} funnel={funnel} />
        )}

        {section === 'tenants' && (
          <Tenants
            tenants={tenants}
            loading={loading}
            onReload={load}
            onError={setError}
            onShowBroadcast={() => setShowBroadcast(true)}
            onPayTenant={setPayTenant}
          />
        )}

        {section === 'solicitudes' && (
          <Solicitudes
            requests={requests}
            onRequestsChange={setRequests}
            onReload={load}
            onError={setError}
          />
        )}

        {section === 'pagos' && (
          <Pagos
            payCfg={payCfg}
            onPayCfgChange={setPayCfg}
            payments={payments}
            onPaymentsChange={setPayments}
            onReload={load}
            totpEnabled={totpEnabled}
            onTotpEnabledChange={setTotpEnabled}
            onError={setError}
          />
        )}
      </div>

      {/* Registrar pago — disparado desde Tenants o Finanzas */}
      {payTenant && payCfg && (
        <RegisterPaymentModal
          tenant={payTenant}
          prices={payCfg.prices}
          onDone={() => { setPayTenant(null); load(); }}
          onClose={() => setPayTenant(null)}
        />
      )}

      {/* Anuncio push — disparado desde el sidebar */}
      {showBroadcast && (
        <BroadcastModal
          tenants={tenants}
          onClose={() => setShowBroadcast(false)}
          onSent={n => { setShowBroadcast(false); setBroadcastOk(`Anuncio enviado a ${n} usuario${n === 1 ? '' : 's'} con push activo`); setTimeout(() => setBroadcastOk(null), 6000); }}
        />
      )}
    </div>
  );
};

export default Superadmin;
