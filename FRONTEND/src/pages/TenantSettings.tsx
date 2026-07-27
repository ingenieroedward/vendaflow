import React, { useState, useEffect } from 'react';
import { Settings, Save, Palette, Building2, CreditCard, Users, Package, ShoppingCart } from 'lucide-react';
import { useTenantStore } from '../store/tenantStore';
import { useUIStore } from '../store/uiStore';
import { getMyTenant, updateMyTheme } from '../services/tenant';
import { apiService } from '../services/api';

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  basic: 'Básico',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const TenantSettings: React.FC = () => {
  const { tenant: currentTenant, setTenant } = useTenantStore();
  const { addNotification } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [payForm, setPayForm] = useState({ plan: 'basic', reference: '', receiptBase64: '', receiptMime: '' });
  const [paySending, setPaySending] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  const loadBilling = () => {
    apiService.get<{ status: string; data: any }>('/tenants/me/billing')
      .then(r => setBilling(r.data)).catch(() => setBilling(null));
  };

  const handleReceiptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setPayMsg('La imagen supera 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const [meta, b64] = dataUrl.split(',');
      setPayForm(prev => ({ ...prev, receiptBase64: b64 ?? '', receiptMime: meta?.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg' }));
    };
    reader.readAsDataURL(file);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billing) return;
    setPaySending(true);
    setPayMsg(null);
    try {
      await apiService.post('/tenants/me/payments', {
        plan: payForm.plan,
        amount: billing.prices[payForm.plan],
        reference: payForm.reference || undefined,
        receiptBase64: payForm.receiptBase64 || undefined,
        receiptMime: payForm.receiptMime || undefined,
      });
      setPayMsg('Pago reportado — te confirmaremos apenas lo verifiquemos.');
      setPayForm({ plan: payForm.plan, reference: '', receiptBase64: '', receiptMime: '' });
      loadBilling();
    } catch (err: any) {
      setPayMsg(err?.message ?? 'No se pudo reportar el pago');
    } finally {
      setPaySending(false);
    }
  };

  const [form, setForm] = useState({
    name: '',
    primaryColor: '#2563eb',
    logoUrl: '',
  });

  useEffect(() => {
    loadBilling();
    getMyTenant().then(t => {
      if (t) {
        setTenantInfo(t);
        setForm({
          name: t.name,
          primaryColor: (t as any).primaryColor ?? '#2563eb',
          logoUrl: (t as any).logoUrl ?? '',
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMyTheme({
        name: form.name,
        ...(form.primaryColor && { primaryColor: form.primaryColor }),
        logoUrl: form.logoUrl || null,
      });

      // Apply immediately — setTenant triggers applyTheme() for instant CSS update
      if (currentTenant) {
        setTenant({
          ...currentTenant,
          name: form.name,
          primaryColor: form.primaryColor,
          logoUrl: form.logoUrl || null,
        });
      }

      addNotification({ type: 'success', title: 'Configuración guardada' });
    } catch (err: unknown) {
      addNotification({
        type: 'error',
        title: 'Error al guardar',
        message: (err as { message?: string })?.message ?? 'Intenta de nuevo',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 px-2">Configuración</h1>
        <p className="text-sm sm:text-lg text-gray-600 px-2">Plan, identidad y personalización de tu empresa.</p>
      </div>

      {/* Plan info */}
      {tenantInfo && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-100">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Plan y límites</h2>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
              tenantInfo.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
              tenantInfo.plan === 'pro' ? 'bg-blue-100 text-blue-700' :
              tenantInfo.plan === 'basic' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {PLAN_LABELS[tenantInfo.plan] ?? tenantInfo.plan}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <Users className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Usuarios</p>
              <p className="text-sm font-bold text-gray-700">hasta {tenantInfo.maxUsers}</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <Package className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Productos</p>
              <p className="text-sm font-bold text-gray-700">hasta {tenantInfo.maxProducts?.toLocaleString('es-CO')}</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <ShoppingCart className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Órd/mes</p>
              <p className="text-sm font-bold text-gray-700">hasta {tenantInfo.maxOrdersPerMonth?.toLocaleString('es-CO')}</p>
            </div>
          </div>
          {tenantInfo.trialEndsAt && tenantInfo.plan === 'trial' && (
            <p className="text-xs text-amber-600 mt-3 text-center">
              Trial vence el {new Date(tenantInfo.trialEndsAt).toLocaleDateString('es-CO')}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Identidad */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-1">
            <Building2 className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Identidad</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nombre de empresa
            </label>
            <input
              name="name" value={form.name} onChange={handle} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              URL del logo
              <span className="font-normal text-gray-400 ml-1">(opcional)</span>
            </label>
            <input
              name="logoUrl" value={form.logoUrl} onChange={handle}
              placeholder="https://ejemplo.com/logo.png"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            {form.logoUrl && (
              <div className="mt-2 flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <img
                  src={form.logoUrl}
                  alt="Logo preview"
                  className="w-8 h-8 object-contain flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-xs text-gray-400">Vista previa del logo</span>
              </div>
            )}
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-1">
            <Palette className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Branding</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Color primario
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color" name="primaryColor" value={form.primaryColor} onChange={handle}
                className="h-9 w-12 rounded border border-gray-300 cursor-pointer p-0.5 flex-shrink-0"
              />
              <input
                name="primaryColor" value={form.primaryColor} onChange={handle}
                placeholder="#2563eb"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            {/* Live preview */}
            <div className="mt-3 flex items-center gap-2">
              <span
                className="px-3 py-1.5 rounded-lg text-white text-xs font-medium"
                style={{ backgroundColor: form.primaryColor }}
              >
                Botón
              </span>
              <span
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: form.primaryColor + '1a', color: form.primaryColor }}
              >
                Badge
              </span>
              <span
                className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: form.primaryColor }}
              />
              <span className="text-xs text-gray-400">Vista previa</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      {/* ── Pagar plan (Bre-B) ── */}
      {billing && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Pagar plan (Bre-B)</h2>
          </div>

          {billing.brebKey ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              Transfiere por <b>Bre-B</b> a la llave <b className="font-mono">{billing.brebKey}</b> ({billing.brebHolder}) y reporta tu pago aquí con el comprobante.
            </div>
          ) : (
            <p className="text-sm text-gray-400">Contáctanos para coordinar tu pago.</p>
          )}

          <form onSubmit={submitPayment} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Plan a pagar</label>
                <select value={payForm.plan} onChange={e => setPayForm(prev => ({ ...prev, plan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(billing.prices as Record<string, number>).map(([k, v]) => (
                    <option key={k} value={k}>{PLAN_LABELS[k] ?? k} — {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)}/mes</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Referencia <span className="text-gray-400">(opcional)</span></label>
                <input value={payForm.reference} onChange={e => setPayForm(prev => ({ ...prev, reference: e.target.value }))} maxLength={120}
                  placeholder="Número de la transferencia"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Comprobante (imagen, máx 2MB)</label>
              <input type="file" accept="image/*" onChange={handleReceiptFile}
                className="block w-full text-xs text-gray-500 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs file:font-medium hover:file:bg-blue-100" />
              {payForm.receiptBase64 && <p className="mt-1 text-xs text-green-600">✓ Comprobante adjunto</p>}
            </div>
            {payMsg && <p className={`text-sm rounded-lg px-3 py-2 ${payMsg.startsWith('Pago reportado') ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-600 bg-red-50 border border-red-200'}`}>{payMsg}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={paySending}
                className="px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                {paySending ? 'Enviando...' : 'Reportar pago'}
              </button>
            </div>
          </form>

          {billing.payments?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Historial de pagos</p>
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {billing.payments.map((pg: any) => (
                  <li key={pg.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-gray-700">
                      {new Date(pg.createdAt).toLocaleDateString('es-CO')} · plan {pg.plan} · {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(pg.amount))}
                      {pg.receiptNumber && <span className="text-green-600 font-medium"> · {pg.receiptNumber}</span>}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${pg.status === 'approved' ? 'bg-green-100 text-green-700' : pg.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                      {pg.status === 'approved' ? 'Confirmado' : pg.status === 'rejected' ? 'Rechazado' : 'En revisión'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TenantSettings;
