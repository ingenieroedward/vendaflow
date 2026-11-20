import React, { useState, useEffect } from 'react';
import { Save, Palette, Building2, Lock, FileText, Check, Receipt } from 'lucide-react';
import { useTenantStore } from '../store/tenantStore';
import { useUIStore } from '../store/uiStore';
import { useFeature } from '../hooks/useFeature';
import { getMyTenant, updateMyTheme } from '../services/tenant';
import { deriveThemeColors, toChannels } from '../utils/themeColors';

type Tpl = 'moderna' | 'clasica';

const inputCls =
  'w-full h-11 px-3 border border-gray-300 rounded-lg text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary';

const Field: React.FC<{ id: string; label: string; optional?: boolean; hint?: string; children: React.ReactNode }> = ({ id, label, optional, hint, children }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-800 mb-1">
      {label} {optional && <span className="font-normal text-gray-600">(opcional)</span>}
    </label>
    {children}
    {hint && <p className="mt-1 text-xs text-gray-600">{hint}</p>}
  </div>
);

const Section: React.FC<{ icon: React.ElementType; title: string; description?: string; children: React.ReactNode }> = ({ icon: Icon, title, description, children }) => (
  <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
    <div>
      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-500" aria-hidden="true" /> {title}
      </h2>
      {description && <p className="text-sm text-gray-600 mt-0.5">{description}</p>}
    </div>
    {children}
  </section>
);

/**
 * Configuración del negocio: identidad, datos que salen en los documentos,
 * color de marca y plantilla de documentos — con vista previa en vivo del
 * encabezado del documento (columna derecha en escritorio).
 */
const TenantSettings: React.FC = () => {
  const { tenant: currentTenant, setTenant } = useTenantStore();
  const { addNotification } = useUIStore();
  const hasCustomBranding = useFeature('custom_branding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    primaryColor: '#2563eb',
    logoUrl: '',
    nit: '',
    address: '',
    city: '',
    contactPhone: '',
    documentTemplate: 'moderna' as Tpl,
  });

  useEffect(() => {
    getMyTenant().then(t => {
      if (t) {
        setForm({
          name: t.name,
          primaryColor: t.primaryColor ?? '#2563eb',
          logoUrl: t.logoUrl ?? '',
          nit: t.nit ?? '',
          address: t.address ?? '',
          city: t.city ?? '',
          contactPhone: t.contactPhone ?? '',
          documentTemplate: t.documentTemplate === 'clasica' ? 'clasica' : 'moderna',
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
      const payload = {
        name: form.name,
        ...(form.primaryColor && { primaryColor: form.primaryColor }),
        // Sin la feature, el campo está oculto — no reenviar un logoUrl
        // heredado de antes de un downgrade, o el backend lo rechaza
        ...(hasCustomBranding && { logoUrl: form.logoUrl || null }),
        nit: form.nit || null,
        address: form.address || null,
        city: form.city || null,
        contactPhone: form.contactPhone || null,
        documentTemplate: form.documentTemplate,
      };
      await updateMyTheme(payload);
      // setTenant aplica el color al instante (applyTheme)
      if (currentTenant) setTenant({ ...currentTenant, ...payload, primaryColor: form.primaryColor, logoUrl: hasCustomBranding ? (form.logoUrl || null) : currentTenant.logoUrl });
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

  // Colores de la vista previa con el mismo ajuste de contraste que la app
  const theme = deriveThemeColors(/^#[0-9a-fA-F]{6}$/.test(form.primaryColor) ? form.primaryColor : '#2563eb');
  const fill = theme ? `rgb(${toChannels(theme.fill).split(' ').join(',')})` : form.primaryColor;
  const onFill = theme ? `rgb(${toChannels(theme.onFill).split(' ').join(',')})` : '#fff';
  const ink = theme ? `rgb(${toChannels(theme.ink).split(' ').join(',')})` : form.primaryColor;
  const businessLines = [
    form.nit ? `NIT ${form.nit}` : null,
    [form.address, form.city].filter(Boolean).join(' · ') || null,
    form.contactPhone ? `Tel. ${form.contactPhone}` : null,
  ].filter(Boolean) as string[];

  const templates: Array<{ key: Tpl; title: string; desc: string }> = [
    { key: 'moderna', title: 'Moderna', desc: 'Con tu color, total destacado y valor en letras. Ticket más legible.' },
    { key: 'clasica', title: 'Clásica', desc: 'El formato de siempre, tipo factura con cajitas.' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-600">Los datos y la apariencia de tu negocio en la app y en tus documentos.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-6 items-start">
        <div className="space-y-4 min-w-0">
          <Section icon={Building2} title="Identidad">
            <Field id="cfg-name" label="Nombre del negocio">
              <input id="cfg-name" name="name" value={form.name} onChange={handle} required className={inputCls} />
            </Field>
            <Field
              id="cfg-logo"
              label="URL del logo"
              optional
              hint={hasCustomBranding ? 'Aparece al instalar la app, en el login, el menú y tus documentos.' : undefined}
            >
              {hasCustomBranding ? (
                <input id="cfg-logo" name="logoUrl" value={form.logoUrl} onChange={handle} placeholder="https://ejemplo.com/logo.png" className={inputCls} />
              ) : (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-sm text-gray-700">
                  <Lock className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Disponible en el plan Pro: tu logo en la app y en tus documentos, en vez del de Merco.</span>
                </div>
              )}
            </Field>
          </Section>

          <Section icon={Receipt} title="Datos para tus documentos" description="Salen en el ticket y en la hoja carta de órdenes y cotizaciones.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="cfg-nit" label="NIT" optional>
                <input id="cfg-nit" name="nit" value={form.nit} onChange={handle} placeholder="900.123.456-7" className={inputCls} />
              </Field>
              <Field id="cfg-phone" label="Teléfono" optional>
                <input id="cfg-phone" name="contactPhone" value={form.contactPhone} onChange={handle} inputMode="tel" placeholder="300 123 4567" className={inputCls} />
              </Field>
              <Field id="cfg-address" label="Dirección" optional>
                <input id="cfg-address" name="address" value={form.address} onChange={handle} placeholder="Calle 10 # 20-30" className={inputCls} />
              </Field>
              <Field id="cfg-city" label="Ciudad" optional>
                <input id="cfg-city" name="city" value={form.city} onChange={handle} placeholder="Bogotá" className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section icon={Palette} title="Color de la marca" description="Se ajusta solo para que botones y textos siempre se lean bien.">
            <Field id="cfg-color" label="Color principal">
              <div className="flex items-center gap-2">
                <input
                  type="color" name="primaryColor" value={form.primaryColor} onChange={handle}
                  aria-label="Elegir color"
                  className="h-11 w-14 rounded-lg border border-gray-300 cursor-pointer p-1 flex-shrink-0"
                />
                <input id="cfg-color" name="primaryColor" value={form.primaryColor} onChange={handle} placeholder="#2563eb" className={`${inputCls} font-mono`} />
              </div>
            </Field>
          </Section>

          <Section icon={FileText} title="Plantilla de documentos" description="La que se usa por defecto al imprimir o descargar. La otra sigue disponible en el menú Imprimir / PDF.">
            <div role="radiogroup" aria-label="Plantilla de documentos" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map(t => {
                const active = form.documentTemplate === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setForm(prev => ({ ...prev, documentTemplate: t.key }))}
                    className={`text-left rounded-xl border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      active ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">{t.title}{t.key === 'moderna' && <span className="ml-2 text-xs font-medium text-gray-600">(nueva)</span>}</span>
                      {active && <Check className="w-4 h-4 text-primary" aria-hidden="true" />}
                    </span>
                    <span className="block mt-1 text-sm text-gray-700">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Vista previa en vivo del encabezado del documento */}
        <aside className="space-y-4 lg:sticky lg:top-4" aria-label="Vista previa">
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <p className="px-4 pt-3 text-xs font-medium text-gray-600">Vista previa · hoja carta ({form.documentTemplate === 'moderna' ? 'moderna' : 'clásica'})</p>
            <div className="m-4 mt-2 rounded-md border border-gray-200 bg-white shadow-sm">
              {form.documentTemplate === 'moderna' ? (
                <div className="text-gray-900">
                  <div style={{ height: 4, background: fill }} />
                  <div className="p-3 flex justify-between gap-2">
                    <div className="min-w-0 flex items-start gap-2">
                      {hasCustomBranding && form.logoUrl && (
                        <img src={form.logoUrl} alt="" className="w-8 h-8 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{form.name || 'Tu negocio'}</p>
                        {businessLines.map(l => <p key={l} className="text-xs text-gray-600 truncate">{l}</p>)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold" style={{ color: ink }}>ORDEN DE VENTA</p>
                      <p className="text-base font-bold">ORD-0123</p>
                    </div>
                  </div>
                  <div className="mx-3 mb-3 rounded px-2 py-1.5 flex justify-between text-xs font-semibold" style={{ background: fill, color: onFill }}>
                    <span>Descripción</span><span>Total</span>
                  </div>
                  <div className="mx-3 mb-3 flex justify-end">
                    <span className="rounded px-2 py-1 text-xs font-bold" style={{ background: fill, color: onFill }}>TOTAL $ 32.000</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-gray-900">
                  <p className="text-sm font-bold">{form.name || 'Tu negocio'}</p>
                  {businessLines.map(l => <p key={l} className="text-xs text-gray-600">{l}</p>)}
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {['ORDEN', 'FECHA', 'CLIENTE'].map(h => (
                      <div key={h} className="border border-sky-200">
                        <p className="bg-sky-50 px-1 text-xs font-bold text-sky-800">{h}</p>
                        <p className="px-1 py-1 text-xs">{h === 'ORDEN' ? 'ORD-0123' : '—'}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <span className="border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-bold">TOTAL $ 32.000</span>
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 pb-4 flex items-center gap-2">
              <span className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: fill, color: onFill }}>Botón</span>
              <span className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: `${form.primaryColor}1a`, color: ink }}>Etiqueta</span>
              <span className="text-xs text-gray-600">Así se ve en la app</span>
            </div>
          </section>

          <button
            type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] px-5 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </aside>
      </form>
    </div>
  );
};

export default TenantSettings;
