import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, LogOut, X, Megaphone, LayoutDashboard, Inbox, Wallet, ScrollText, Settings, Bell, BellOff, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { tenantAdminService, TenantSummary, TenantRequestItem, PlanPaymentItem, FinanceData, AuditLogItem, PlatformSettings, PlatformStats } from '../services/tenantAdmin';
import { SectionKey, SECTION_KEYS, SECTION_TITLES } from '../utils/adminHelpers';
import BroadcastModal from '../components/BroadcastModal';
import RegisterPaymentModal from '../components/RegisterPaymentModal';
import Dashboard from './sections/Dashboard';
import Tenants from './sections/Tenants';
import Bandeja from './sections/Bandeja';
import Configuracion from './sections/Configuracion';
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
  const location = useLocation();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastOk, setBroadcastOk] = useState<string | null>(null);
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [payTenant, setPayTenant] = useState<TenantSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const {
    isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading,
    isDenied: pushDenied, error: pushError, clearError: clearPushError, toggle: togglePush,
  } = usePushNotifications();
  const [requests, setRequests] = useState<TenantRequestItem[]>([]);
  const [payments, setPayments] = useState<PlanPaymentItem[]>([]);
  const [payCfg, setPayCfg] = useState<PlatformSettings | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  // Qué llamadas secundarias de load() fallaron — antes un error acá se
  // tragaba en silencio (.catch(() => setX(null))) y la sección afectada se
  // quedaba en "Cargando…" para siempre, sin ningún indicio de que algo
  // salió mal (nadie más va a reportarlo con un solo operador).
  const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const track = <T,>(key: string, promise: Promise<T>, setter: (v: T) => void, fallback: T) => {
      promise
        .then(v => { setter(v); setLoadErrors(prev => (prev[key] ? { ...prev, [key]: false } : prev)); })
        .catch(() => { setter(fallback); setLoadErrors(prev => ({ ...prev, [key]: true })); });
    };
    try {
      setTenants(await tenantAdminService.listAll());
      track('platform', tenantAdminService.platformStats(), setPlatform, null);
      track('requests', tenantAdminService.listRequests(), setRequests, []);
      track('payments', tenantAdminService.listPayments(), setPayments, []);
      track('payCfg', tenantAdminService.getPlatformSettings(), setPayCfg, null);
      track('funnel', tenantAdminService.getFunnel(), setFunnel, null);
      track('finance', tenantAdminService.getFinance(), setFinance, null);
      track('auditLogs', tenantAdminService.listAudit(), setAuditLogs, []);
      track('totpEnabled', tenantAdminService.totpStatus().then(r => r.enabled), setTotpEnabled, null);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Error al cargar tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // La sección activa vive en la URL (no en useState) — así una recarga o un
  // link directo (/tenants, /bandeja, ...) aterriza donde corresponde en vez
  // de volver siempre a Dashboard.
  const pathSection = location.pathname.replace(/^\//, '') as SectionKey;
  const section: SectionKey = SECTION_KEYS.includes(pathSection) ? pathSection : 'dashboard';
  const setSection = (s: SectionKey) => navigate(`/${s}`);

  useEffect(() => {
    if (location.pathname === '/') navigate('/dashboard', { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    document.title = `Merco · ${SECTION_TITLES[section]}`;
  }, [section]);

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const bandejaCount = pendingRequests.length + pendingPayments.length;

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
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-none">Merco</p>
            <p className="text-xs text-slate-400 leading-none mt-0.5">Superadmin</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            title="Recargar datos"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button onClick={() => setSection('dashboard')} className={navCls(section === 'dashboard')}>
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Dashboard
          </button>
          <button onClick={() => setSection('bandeja')} className={navCls(section === 'bandeja')}>
            <Inbox className="w-4 h-4 flex-shrink-0" /> Bandeja
            {bandejaCount > 0 && (
              <span className="ml-auto text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full">{bandejaCount}</span>
            )}
          </button>
          <button onClick={() => setSection('tenants')} className={navCls(section === 'tenants')}>
            <Building2 className="w-4 h-4 flex-shrink-0" /> Tenants
            <span className="ml-auto text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{tenants.length}</span>
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
          <button onClick={() => setSection('configuracion')} className={navCls(section === 'configuracion')}>
            <Settings className="w-4 h-4 flex-shrink-0" /> Configuración
          </button>
          <div className="pt-2 mt-2 border-t border-white/10">
            <button onClick={() => setShowBroadcast(true)} className={navCls(false)}>
              <Megaphone className="w-4 h-4 flex-shrink-0" /> Anuncio
            </button>
          </div>
        </nav>
        <div className="px-3 py-4 border-t border-white/10 flex-shrink-0">
          {pushSupported && (
            <button
              onClick={togglePush}
              disabled={pushLoading}
              className="flex items-center gap-2.5 w-full px-3 py-2 mb-1 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              title={pushDenied ? 'Bloqueadas por el navegador — actívalas desde el candado de la barra de direcciones' : pushSubscribed ? 'Desactivar notificaciones' : 'Activar notificaciones (pagos, solicitudes, trials)'}
            >
              {pushSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              <span className="flex-1 text-left">Notificaciones</span>
              <span className={`w-2 h-2 rounded-full ${pushSubscribed ? 'bg-green-500' : pushDenied ? 'bg-red-500' : 'bg-slate-600'}`} />
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
          <button onClick={() => setSection('bandeja')} className={`relative p-2 rounded-lg ${section === 'bandeja' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
            <Inbox className="w-4 h-4" />
            {bandejaCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />}
          </button>
          <button onClick={() => setSection('tenants')} className={`p-2 rounded-lg ${section === 'tenants' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
            <Building2 className="w-4 h-4" />
          </button>
          <button onClick={() => setSection('finanzas')} className={`relative p-2 rounded-lg ${section === 'finanzas' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
            <Wallet className="w-5 h-5" />
            {finance && finance.overdue.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          <button onClick={() => setSection('configuracion')} className={`p-2 rounded-lg ${section === 'configuracion' ? 'bg-white/10 text-white' : 'text-slate-300'}`}>
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={load} disabled={loading} title="Recargar datos" className="p-2 rounded-lg text-slate-300 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
        {pushError && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <span>{pushError}</span>
            <button onClick={clearPushError} className="ml-3 text-amber-500 hover:text-amber-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {section === 'auditoria' && (
          <Auditoria auditLogs={auditLogs} failed={loadErrors.auditLogs ?? false} onReload={load} />
        )}

        {section === 'finanzas' && (
          <Finanzas finance={finance} tenants={tenants} onPayTenant={setPayTenant} failed={loadErrors.finance ?? false} onReload={load} />
        )}

        {section === 'dashboard' && (
          <Dashboard
            tenants={tenants}
            platform={platform}
            funnel={funnel}
            requests={requests}
            payments={payments}
            finance={finance}
            onNavigate={setSection}
          />
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

        {section === 'bandeja' && (
          <Bandeja
            requests={requests}
            onRequestsChange={setRequests}
            payments={payments}
            onPaymentsChange={setPayments}
            onReload={load}
            onError={setError}
          />
        )}

        {section === 'configuracion' && (
          <Configuracion
            payCfg={payCfg}
            onPayCfgChange={setPayCfg}
            totpEnabled={totpEnabled}
            onTotpEnabledChange={setTotpEnabled}
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
