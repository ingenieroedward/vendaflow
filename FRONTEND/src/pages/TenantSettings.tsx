import React, { useState, useEffect } from 'react';
import { Settings, Save, Palette, Building2, CreditCard, Users, Package, ShoppingCart, Lock, Check } from 'lucide-react';
import { useTenantStore } from '../store/tenantStore';
import { useUIStore } from '../store/uiStore';
import { useFeature } from '../hooks/useFeature';
import { getMyTenant, updateMyTheme } from '../services/tenant';
import { apiService } from '../services/api';

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  basic: 'Básico',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

// Debe reflejar ALL_FEATURES/PLAN_FEATURES en BACKEND/src/config/features.ts.
// "minPlan" es orientativo (el plan pago más bajo que la trae por defecto) —
// el superadmin puede reconfigurar qué trae cada plan sin deploy, así que
// esto es una aproximación para el mensaje, no la fuente de verdad.
// "soon" marca features con gating listo pero sin UI/rutas reales todavía
// (ver CLAUDE.md) — para no mostrar un check sin nada detrás que abrir.
const FEATURE_INFO: Record<string, { label: string; minPlan: string; soon?: boolean }> = {
  pos: { label: 'Punto de venta (POS)', minPlan: 'Pro' },
  custom_branding: { label: 'Marca propia (logo)', minPlan: 'Pro' },
  multi_warehouse: { label: 'Múltiples bodegas', minPlan: 'Enterprise', soon: true },
  api_access: { label: 'Acceso API', minPlan: 'Enterprise', soon: true },
};

const TenantSettings: React.FC = () => {
  const { tenant: currentTenant, setTenant } = useTenantStore();
  const { addNotification } = useUIStore();
  const hasCustomBranding = useFeature('custom_branding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [payForm, setPayForm] = useState({ plan: 'basic', months: 1, reference: '', receiptBase64: '', receiptMime: '' });
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
      const effectiveAmount = (billing.customPrice ?? billing.prices[payForm.plan]) * payForm.months;
      await apiService.post('/tenants/me/payments', {
        plan: payForm.plan,
        amount: effectiveAmount,
        months: payForm.months,
        reference: payForm.reference || undefined,
        receiptBase64: payForm.receiptBase64 || undefined,
        receiptMime: payForm.receiptMime || undefined,
      });
      setPayMsg('Pago reportado — te confirmaremos apenas lo verifiquemos.');
      setPayForm({ plan: payForm.plan, months: 1, reference: '', receiptBase64: '', receiptMime: '' });
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
    nit: '',
    address: '',
    city: '',
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
          nit: t.nit ?? '',
          address: t.address ?? '',
          city: t.city ?? '',
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
        // Sin la feature, el campo está oculto — no reenviar un logoUrl
        // heredado de antes de un downgrade, o el backend lo rechaza
        ...(hasCustomBranding && { logoUrl: form.logoUrl || null }),
        nit: form.nit || null,
        address: form.address || null,
        city: form.city || null,
      });

      // Apply immediately — setTenant triggers applyTheme() for instant CSS update
      if (currentTenant) {
        setTenant({
          ...currentTenant,
          name: form.name,
          primaryColor: form.primaryColor,
          ...(hasCustomBranding && { logoUrl: form.logoUrl || null }),
          nit: form.nit || null,
          address: form.address || null,
          city: form.city || null,
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
              tenantInfo.plan === 'pro' ? 'bg-primary/15 text-primary' :
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
          {/* Funciones del plan — qué incluye y qué no, con mensaje de upgrade
              en vez de simplemente ocultar el ítem del menú sin explicar por qué */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Funciones</p>
            <div className="space-y-1.5">
              {Object.entries(FEATURE_INFO).map(([key, info]) => {
                const included = (tenantInfo.features ?? []).includes(key);
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    {included ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    )}
                    <span className={included ? 'text-gray-700' : 'text-gray-400'}>
                      {info.label}
                      {info.soon && <span className="text-gray-400"> (próximamente)</span>}
                    </span>
                    {!included && (
                      <span className="ml-auto text-gray-400">Disponible en el plan {info.minPlan}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {(tenantInfo as { paidUntil?: string | null }).paidUntil && (
            <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 inline-block">
              Plan activo hasta el {new Date(`${(tenantInfo as { paidUntil?: string }).paidUntil}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
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
            {hasCustomBranding ? (
              <>
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
                <p className="mt-1.5 text-[11px] text-gray-400">Aparece al instalar la app, en el login, el menú y los recibos impresos.</p>
              </>
            ) : (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500">
                <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>Disponible en el plan Pro — tu logo en la app, en el login y en los recibos impresos, en vez del de Merco.</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              NIT <span className="font-normal text-gray-400 ml-1">(opcional)</span>
            </label>
            <input
              name="nit" value={form.nit} onChange={handle}
              placeholder="900.123.456-7"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Dirección <span className="font-normal text-gray-400 ml-1">(opcional)</span>
            </label>
            <input
              name="address" value={form.address} onChange={handle}
              placeholder="Calle 10 # 20-30"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Ciudad <span className="font-normal text-gray-400 ml-1">(opcional)</span>
            </label>
            <input
              name="city" value={form.city} onChange={handle}
              placeholder="Bogotá"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <p className="text-[11px] text-gray-400 -mt-2">NIT, dirección y ciudad aparecen en tus PDF de venta (ticket y hoja carta).</p>
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

          {billing.customPrice != null && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Tienes un precio especial: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(billing.customPrice)}/mes
            </p>
          )}
          {billing.brebKey ? (
            <div className="bg-primary/10 border border-primary/25 rounded-lg p-3 text-sm text-primary">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                  {Object.entries(billing.prices as Record<string, number>).map(([k, v]) => (
                    <option key={k} value={k}>{PLAN_LABELS[k] ?? k} — {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(billing.customPrice ?? v)}/mes</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Meses a pagar</label>
                <select value={payForm.months} onChange={e => setPayForm(prev => ({ ...prev, months: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                  {[1, 2, 3, 6, 12].map(m => (
                    <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'} — {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format((billing.customPrice ?? billing.prices[payForm.plan] ?? 0) * m)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Referencia <span className="text-gray-400">(opcional)</span></label>
                <input value={payForm.reference} onChange={e => setPayForm(prev => ({ ...prev, reference: e.target.value }))} maxLength={120}
                  placeholder="Número de la transferencia"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Comprobante (imagen, máx 2MB)</label>
              <input type="file" accept="image/*" onChange={handleReceiptFile}
                className="block w-full text-xs text-gray-500 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-xs file:font-medium hover:file:bg-primary/15" />
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
                      {pg.receiptUrl && (
                        <a href={pg.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium"> · Ver recibo</a>
                      )}
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
