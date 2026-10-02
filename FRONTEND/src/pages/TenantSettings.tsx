import React, { useState, useEffect } from 'react';
import { Save, Palette, Building2, Lock } from 'lucide-react';
import { useTenantStore } from '../store/tenantStore';
import { useUIStore } from '../store/uiStore';
import { useFeature } from '../hooks/useFeature';
import { getMyTenant, updateMyTheme } from '../services/tenant';

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
  });

  useEffect(() => {
    getMyTenant().then(t => {
      if (t) {
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
        <p className="text-sm sm:text-lg text-gray-600 px-2">Identidad y personalización de tu empresa.</p>
      </div>

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
    </div>
  );
};

export default TenantSettings;
