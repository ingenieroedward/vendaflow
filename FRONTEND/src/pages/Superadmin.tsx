import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Power, PowerOff, LogOut, RefreshCw, X, Search, ExternalLink, Edit, AlertTriangle, ClipboardList, Users, TrendingUp, Eye, LogIn, Megaphone, Download, Activity, LayoutDashboard, Inbox, Receipt, Check, Bell, BellOff, Wallet, DollarSign } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { tenantAdminService, TenantSummary, CreateTenantPayload, UpdateTenantPayload, TenantDetail, PlatformStats, TenantRequestItem, PlanPaymentItem, FinanceData } from '../services/tenantAdmin';

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
  // Funciona desde merco.edwsystem.com y admin.merco.edwsystem.com
  const base = 'merco.edwsystem.com';
  return `https://${slug}.${base}`;
}

// ---- Usage pill: usado/límite con alerta al acercarse al tope ----

const UsagePill: React.FC<{ used: number; max: number; title: string }> = ({ used, max, title }) => {
  const ratio = max > 0 ? used / max : 0;
  const cls =
    ratio >= 1 ? 'text-red-600 font-semibold'
    : ratio >= 0.7 ? 'text-amber-600 font-medium'
    : 'text-gray-500';
  return (
    <span className={cls} title={title}>
      {used}/{max}
    </span>
  );
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
    customPrice: tenant.customPrice != null ? String(tenant.customPrice) : '',
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
        customPrice: form.customPrice.trim() === '' ? null : Number(form.customPrice),
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
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Precio especial (COP/mes)</label>
            <input type="number" name="customPrice" value={form.customPrice} onChange={handle} min={0}
              placeholder="Vacío = precio de lista del plan"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="mt-0.5 text-[11px] text-gray-400">Descuento o tarifa negociada — es lo que este tenant verá y pagará</p>
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

// ---- Broadcast Modal ----

const BroadcastModal: React.FC<{
  tenants: TenantSummary[];
  onClose: () => void;
  onSent: (recipients: number) => void;
}> = ({ tenants, onClose, onSent }) => {
  const [tenantId, setTenantId] = useState<string>('');
  const [onlyAdmins, setOnlyAdmins] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const r = await tenantAdminService.broadcast({
        ...(tenantId ? { tenantId: Number(tenantId) } : {}),
        onlyAdmins,
        title,
        body,
      });
      onSent(r.recipients);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'No se pudo enviar');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={send} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-gray-400" /> Anuncio push
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Destinatario</label>
          <select
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Toda la plataforma</option>
            {tenants.filter(t => t.slug !== 'platform').map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input type="checkbox" checked={onlyAdmins} onChange={e => setOnlyAdmins(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
          Solo administradores
        </label>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
          <input
            value={title} onChange={e => setTitle(e.target.value)} required maxLength={80}
            placeholder="Mantenimiento programado"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Mensaje *</label>
          <textarea
            value={body} onChange={e => setBody(e.target.value)} required rows={3} maxLength={300}
            placeholder="El domingo 3 de agosto de 2 a 3 AM la plataforma estará en mantenimiento..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <p className="text-[11px] text-gray-400">
          Solo llega a usuarios con notificaciones push activadas en la app.
        </p>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button type="submit" disabled={sending} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ---- Approve Request Modal ----

const ApproveRequestModal: React.FC<{
  request: TenantRequestItem;
  onApprove: (data: { slug: string; adminUsername: string; adminPassword: string; plan?: string }) => Promise<void>;
  onClose: () => void;
}> = ({ request, onApprove, onClose }) => {
  const suggestedSlug = request.companyName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  const [slug, setSlug] = useState(suggestedSlug);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [plan, setPlan] = useState('trial');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onApprove({ slug, adminUsername, adminPassword, plan });
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Error al aprobar');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-base font-bold text-gray-900">Aprobar solicitud</h3>
          <p className="text-xs text-gray-400">{request.companyName} · {request.contactName} ({request.email})</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Slug (subdominio) *</label>
          <input value={slug} onChange={e => setSlug(e.target.value)} required pattern="[a-z0-9-]+"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="mt-0.5 text-[11px] text-gray-400">{slug || 'slug'}.merco.edwsystem.com</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Usuario admin *</label>
            <input value={adminUsername} onChange={e => setAdminUsername(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña *</label>
            <input value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="trial">Trial (14 días)</option>
            <option value="basic">Básico</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
            {saving ? 'Creando...' : 'Aprobar y crear tenant'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ---- Main Page ----


// Registro manual de un pago recibido por fuera (transferencia/efectivo)
const RegisterPaymentModal: React.FC<{
  tenant: TenantSummary;
  prices: Record<string, number>;
  onDone: () => void;
  onClose: () => void;
}> = ({ tenant, prices, onDone, onClose }) => {
  const [plan, setPlan] = useState(tenant.plan === 'trial' ? 'basic' : tenant.plan);
  const [months, setMonths] = useState(1);
  const [amountTouched, setAmountTouched] = useState(false);
  const unitPrice = (pl: string) => (tenant.customPrice != null ? Number(tenant.customPrice) : (prices[pl] ?? 0));
  const [amount, setAmount] = useState(unitPrice(tenant.plan === 'trial' ? 'basic' : tenant.plan));
  const [method, setMethod] = useState('transferencia');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recompute = (pl: string, m: number) => {
    if (!amountTouched) setAmount(unitPrice(pl) * m);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await tenantAdminService.registerPayment(tenant.id, {
        plan, amount, months, method, paidAt,
        reference: reference || undefined, notes: notes || undefined,
      });
      onDone();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'No se pudo registrar el pago');
      setSaving(false);
    }
  };

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-base font-bold text-gray-900">Registrar pago</h3>
          <p className="text-xs text-gray-400">
            {tenant.name} · {tenant.paidUntil ? `pagado hasta ${tenant.paidUntil}` : 'sin ciclo de pago aún'}
            {tenant.customPrice != null && <span className="text-indigo-500"> · precio especial</span>}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
            <select value={plan} onChange={e => { setPlan(e.target.value); recompute(e.target.value, months); }} className={inp}>
              {['basic', 'pro', 'enterprise'].map(pl => (
                <option key={pl} value={pl}>{PLAN_LABELS[pl] ?? pl}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Meses</label>
            <select value={months} onChange={e => { const m = Number(e.target.value); setMonths(m); recompute(plan, m); }} className={inp}>
              {[1, 2, 3, 6, 12].map(m => <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Monto (COP)</label>
            <input type="number" min="0" value={amount}
              onChange={e => { setAmount(Number(e.target.value)); setAmountTouched(true); }} className={inp} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha del pago</label>
            <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className={inp} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Método</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className={inp}>
              <option value="transferencia">Transferencia</option>
              <option value="breb">Bre-B</option>
              <option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Referencia</label>
            <input value={reference} onChange={e => setReference(e.target.value)} className={inp} placeholder="Opcional" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nota</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} className={inp} placeholder="Ej: pagó en la visita" maxLength={255} />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? 'Registrando…' : `Registrar $${Number(amount).toLocaleString('es-CO')}`}
          </button>
        </div>
      </form>
    </div>
  );
};

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
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastOk, setBroadcastOk] = useState<string | null>(null);
  const [section, setSection] = useState<'dashboard' | 'tenants' | 'solicitudes' | 'pagos' | 'finanzas'>('dashboard');
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [payTenant, setPayTenant] = useState<TenantSummary | null>(null);
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, toggle: togglePush } = usePushNotifications();
  const [requests, setRequests] = useState<TenantRequestItem[]>([]);
  const [payments, setPayments] = useState<PlanPaymentItem[]>([]);
  const [approveReq, setApproveReq] = useState<TenantRequestItem | null>(null);
  const [receiptView, setReceiptView] = useState<{ payment: PlanPaymentItem; src: string | null } | null>(null);
  const [payCfg, setPayCfg] = useState<{ brebKey: string; brebHolder: string; prices: Record<string, number> } | null>(null);
  const [funnel, setFunnel] = useState<{ days: number; landingViews: number; registroViews: number; requests: number; approved: number } | null>(null);
  const [payCfgSaving, setPayCfgSaving] = useState(false);
  const [payCfgMsg, setPayCfgMsg] = useState<string | null>(null);
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
      setError((e as { message?: string })?.message ?? 'No se pudo impersonar');
    }
  };

  const handleExtendTrial = async (t: TenantSummary, days: number) => {
    try {
      const base = t.trialEndsAt && new Date(t.trialEndsAt) > new Date() ? new Date(t.trialEndsAt) : new Date();
      base.setDate(base.getDate() + days);
      await tenantAdminService.update(t.id, { trialEndsAt: base.toISOString().slice(0, 10) });
      await load();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'No se pudo extender el trial');
    }
  };

  const handleOpenDetail = async (t: TenantSummary) => {
    setDetailLoading(true);
    try {
      setDetail(await tenantAdminService.getDetail(t.id));
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'No se pudo cargar el detalle');
    } finally {
      setDetailLoading(false);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pendingPayments = payments.filter(p => p.status === 'pending');

  const handleApproveRequest = async (data: { slug: string; adminUsername: string; adminPassword: string; plan?: string }) => {
    if (!approveReq) return;
    await tenantAdminService.approveRequest(approveReq.id, data);
    setApproveReq(null);
    await load();
  };

  const handleRejectRequest = async (id: number) => {
    try { await tenantAdminService.rejectRequest(id); setRequests(await tenantAdminService.listRequests()); }
    catch (e: unknown) { setError((e as { message?: string })?.message ?? 'Error'); }
  };

  const handleSavePayCfg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCfg) return;
    setPayCfgSaving(true);
    setPayCfgMsg(null);
    try {
      setPayCfg(await tenantAdminService.updatePlatformSettings(payCfg));
      setPayCfgMsg('Configuración guardada');
      setTimeout(() => setPayCfgMsg(null), 4000);
    } catch (err: unknown) {
      setPayCfgMsg((err as { message?: string })?.message ?? 'Error al guardar');
    } finally {
      setPayCfgSaving(false);
    }
  };

  const handleViewReceipt = async (payment: PlanPaymentItem) => {
    try {
      const r = await tenantAdminService.getPaymentReceipt(payment.id);
      setReceiptView({ payment, src: r.receiptBase64 ? `data:${r.receiptMime ?? 'image/jpeg'};base64,${r.receiptBase64}` : null });
    } catch (e: unknown) { setError((e as { message?: string })?.message ?? 'Error'); }
  };

  const handleDecidePayment = async (id: number, approve: boolean) => {
    try {
      if (approve) await tenantAdminService.approvePayment(id);
      else await tenantAdminService.rejectPayment(id, prompt('Motivo del rechazo (opcional):') ?? undefined);
      setReceiptView(null);
      await load();
      setPayments(await tenantAdminService.listPayments());
    } catch (e: unknown) { setError((e as { message?: string })?.message ?? 'Error'); }
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
      setError((e as { message?: string })?.message ?? 'No se pudo exportar');
    }
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

  const expiringTenants = tenants.filter(t => t.trialEndsAt && daysUntil(t.trialEndsAt) <= 7 && t.status === 'trial');

  const activos = tenants.filter(t => t.status === 'active').length;
  const enTrial = tenants.filter(t => t.status === 'trial').length;
  const suspendidos = tenants.filter(t => t.status === 'suspended').length;
  const totalUsers = tenants.reduce((s, t) => s + (t.usage?.users ?? 0), 0);
  const totalOrdersMonth = tenants.reduce((s, t) => s + (t.usage?.ordersThisMonth ?? 0), 0);

  const kpis = [
    {
      label: 'Tenants',
      value: String(tenants.length),
      sub: `${activos} activos · ${enTrial} trial${suspendidos ? ` · ${suspendidos} susp.` : ''}`,
      icon: Building2,
      iconBg: 'bg-blue-100',
      iconCls: 'text-blue-600',
      accent: 'text-gray-900',
    },
    {
      label: 'Órdenes este mes',
      value: String(totalOrdersMonth),
      sub: 'en toda la plataforma',
      icon: TrendingUp,
      iconBg: 'bg-green-100',
      iconCls: 'text-green-600',
      accent: 'text-gray-900',
    },
    {
      label: 'Usuarios',
      value: String(totalUsers),
      sub: 'en todos los tenants',
      icon: Users,
      iconBg: 'bg-violet-100',
      iconCls: 'text-violet-600',
      accent: 'text-gray-900',
    },
    {
      label: 'Trials por vencer',
      value: String(expiringTenants.length),
      sub: expiringTenants.length ? 'vencen en ≤7 días' : 'ninguno próximo',
      icon: AlertTriangle,
      iconBg: expiringTenants.length ? 'bg-amber-100' : 'bg-gray-100',
      iconCls: expiringTenants.length ? 'text-amber-600' : 'text-gray-400',
      accent: expiringTenants.length ? 'text-amber-600' : 'text-gray-900',
    },
  ];

  // Ranking de actividad del mes — quién está usando la plataforma de verdad
  const topTenants = [...tenants]
    .filter(t => (t.usage?.ordersThisMonth ?? 0) > 0)
    .sort((a, b) => (b.usage?.ordersThisMonth ?? 0) - (a.usage?.ordersThisMonth ?? 0))
    .slice(0, 5);
  const maxOrders = topTenants[0]?.usage?.ordersThisMonth ?? 1;

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

        {section === 'finanzas' && (<>
          {!finance ? (
            <div className="text-center py-16 text-gray-400 text-sm">Cargando finanzas…</div>
          ) : (<>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500">MRR</p>
                <p className="text-2xl font-bold text-gray-900">${finance.mrr.toLocaleString('es-CO')}</p>
                <p className="text-[11px] text-gray-400">{finance.activePaying} tenant(s) pagando</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500">Cobrado este mes</p>
                {(() => {
                  const now = new Date().toISOString().slice(0, 7);
                  const cur = finance.revenueByMonth.find(r => r.month === now)?.total ?? 0;
                  const prevKey = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
                  const prev = finance.revenueByMonth.find(r => r.month === prevKey)?.total ?? 0;
                  const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
                  return (<>
                    <p className="text-2xl font-bold text-gray-900">${cur.toLocaleString('es-CO')}</p>
                    <p className={`text-[11px] ${delta == null ? 'text-gray-400' : delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {delta == null ? 'sin mes anterior' : `${delta >= 0 ? '+' : ''}${delta}% vs mes anterior`}
                    </p>
                  </>);
                })()}
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500">Morosos</p>
                <p className={`text-2xl font-bold ${finance.overdue.length ? 'text-red-600' : 'text-gray-900'}`}>{finance.overdue.length}</p>
                <p className="text-[11px] text-gray-400">${finance.overdue.reduce((s, t) => s + t.amount, 0).toLocaleString('es-CO')} en riesgo</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500">Vencen en 30 días</p>
                <p className="text-2xl font-bold text-gray-900">{finance.upcoming.length}</p>
                <p className="text-[11px] text-gray-400">${finance.upcoming.reduce((s, t) => s + t.amount, 0).toLocaleString('es-CO')} por cobrar</p>
              </div>
            </div>

            {/* Ingresos por mes */}
            {finance.revenueByMonth.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Ingresos por mes</h3>
                <div className="flex items-end gap-3 h-28">
                  {finance.revenueByMonth.map(r => {
                    const max = Math.max(...finance.revenueByMonth.map(x => x.total), 1);
                    return (
                      <div key={r.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-gray-500">${Math.round(r.total / 1000)}k</span>
                        <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${Math.max(4, Math.round((r.total / max) * 80))}px` }} />
                        <span className="text-[10px] text-gray-400">{r.month.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Morosos */}
            {finance.overdue.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-red-200 mb-6 overflow-hidden">
                <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                  <h3 className="text-sm font-semibold text-red-800">Morosos — cobrar ya (gracia: {finance.graceDays} días)</h3>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {finance.overdue.map(t => (
                      <tr key={t.id}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{t.name}
                          {t.suspended && <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">suspendido</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">venció {t.paidUntil ?? '—'}{t.daysOverdue != null ? ` (hace ${t.daysOverdue}d)` : ''}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">${t.amount.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => { const full = tenants.find(x => x.id === t.id); if (full) setPayTenant(full); }}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          >
                            Registrar pago
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Próximos vencimientos */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Próximos vencimientos (30 días)</h3>
              </div>
              {finance.upcoming.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">Nada vence en los próximos 30 días</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {finance.upcoming.map(t => (
                      <tr key={t.id}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{t.name}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                          vence {t.paidUntil} {t.daysLeft != null && <span className={t.daysLeft <= finance.renewalWarnDays ? 'text-amber-600 font-semibold' : ''}>({t.daysLeft}d)</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">${t.amount.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => { const full = tenants.find(x => x.id === t.id); if (full) setPayTenant(full); }}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50"
                          >
                            Registrar pago
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Sin fecha de pago */}
            {finance.noPaidUntil.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-amber-200 mb-6 overflow-hidden">
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                  <h3 className="text-sm font-semibold text-amber-800">Sin fecha de pago — registra su último pago para que entren al ciclo</h3>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {finance.noPaidUntil.map(t => (
                      <tr key={t.id}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{t.name}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{PLAN_LABELS[t.plan] ?? t.plan} · ${t.amount.toLocaleString('es-CO')}/mes</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => { const full = tenants.find(x => x.id === t.id); if (full) setPayTenant(full); }}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          >
                            Registrar pago
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Histórico por tenant */}
            {finance.ltv.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Histórico cobrado por tenant</h3>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {finance.ltv.map(r => (
                      <tr key={r.tenantId}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{r.payments} pago(s) · cliente desde {new Date(r.since).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">${r.totalPaid.toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>)}
        </>)}

        {section === 'dashboard' && (<>
        {/* KPIs de la plataforma */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map(k => (
            <div key={k.label} className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${k.iconBg}`}>
                <k.icon className={`w-5 h-5 ${k.iconCls}`} />
              </div>
              <p className={`text-2xl font-bold leading-none ${k.accent}`}>{k.value}</p>
              <p className="text-xs font-medium text-gray-500 mt-1.5">{k.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Actividad del mes por tenant */}
        {topTenants.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Actividad del mes</h3>
              <span className="text-xs text-gray-400">órdenes por tenant</span>
            </div>
            <div className="space-y-3">
              {topTenants.map(t => {
                const orders = t.usage?.ordersThisMonth ?? 0;
                return (
                  <div key={t.id} className="flex items-center gap-3">
                    <div className="w-36 sm:w-44 flex items-center gap-2 flex-shrink-0 min-w-0">
                      {t.primaryColor && (
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-black/10"
                          style={{ backgroundColor: t.primaryColor }}
                        />
                      )}
                      <span className="text-xs font-medium text-gray-700 truncate">{t.name}</span>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.max(6, (orders / maxOrders) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 w-8 text-right flex-shrink-0">{orders}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Crecimiento y salud del sistema */}
        {platform && (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Crecimiento</h3>
                <span className="text-xs text-gray-400">últimos 6 meses</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Órdenes por mes (plataforma)</p>
                  <div className="flex items-end gap-1.5 h-24">
                    {platform.ordersByMonth.map(m => {
                      const max = Math.max(...platform.ordersByMonth.map(x => x.count), 1);
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1" title={`${m.count} órdenes`}>
                          <span className="text-[10px] text-gray-500 font-medium">{m.count}</span>
                          <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(6, Math.round((m.count / max) * 52))}px` }} />
                          <span className="text-[10px] text-gray-400">{m.month.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Tenants nuevos por mes</p>
                  <div className="flex items-end gap-1.5 h-24">
                    {platform.tenantsByMonth.length === 0 ? (
                      <p className="text-xs text-gray-400 self-center">Sin registros en el período</p>
                    ) : platform.tenantsByMonth.map(m => {
                      const max = Math.max(...platform.tenantsByMonth.map(x => x.count), 1);
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1" title={`${m.count} tenants`}>
                          <span className="text-[10px] text-gray-500 font-medium">{m.count}</span>
                          <div className="w-full bg-violet-500 rounded-t" style={{ height: `${Math.max(6, Math.round((m.count / max) * 52))}px` }} />
                          <span className="text-[10px] text-gray-400">{m.month.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Sistema</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Versión desplegada: <span className="font-mono font-semibold text-gray-800">{platform.version}</span>
              </p>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Jobs diarios</p>
              <div className="space-y-1.5">
                {Object.keys(platform.jobs).length === 0 && (
                  <p className="text-xs text-gray-400">Aún sin corridas (el backend arrancó hace poco)</p>
                )}
                {Object.entries(platform.jobs).map(([name, j]) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{name}</span>
                    <span className={`flex items-center gap-1 font-medium ${j.ok ? 'text-green-600' : 'text-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${j.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                      {new Date(j.at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Embudo comercial */}
        {funnel && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Embudo comercial</h3>
              <span className="text-xs text-gray-400">últimos {funnel.days} días</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Visitas landing', value: funnel.landingViews, sub: 'merco.edwsystem.com' },
                { label: 'Abrieron registro', value: funnel.registroViews, sub: funnel.landingViews > 0 ? `${Math.round((funnel.registroViews / funnel.landingViews) * 100)}% de visitas` : '—' },
                { label: 'Solicitudes', value: funnel.requests, sub: funnel.registroViews > 0 ? `${Math.round((funnel.requests / funnel.registroViews) * 100)}% de registros` : '—' },
                { label: 'Aprobadas', value: funnel.approved, sub: funnel.requests > 0 ? `${Math.round((funnel.approved / funnel.requests) * 100)}% de solicitudes` : '—' },
              ].map((s, i) => (
                <div key={s.label} className="relative bg-gray-50 rounded-lg p-3">
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs font-medium text-gray-500">{s.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
                  {i < 3 && <span className="hidden sm:block absolute -right-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-sm">→</span>}
                </div>
              ))}
            </div>
          </div>
        )}

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

        </>)}

        {section === 'tenants' && (<>
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
              onClick={() => setShowBroadcast(true)}
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
                                onClick={() => setPayTenant(t)}
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
                            {t.status === 'suspended' ? (
                              <button
                                onClick={() => handleActivate(t.id)}
                                disabled={actionId === t.id}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
                                title="Activar tenant"
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSuspend(t.id)}
                                disabled={actionId === t.id || t.status === 'cancelled'}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                title="Suspender tenant"
                              >
                                <PowerOff className="w-3.5 h-3.5" />
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
        </>)}

        {section === 'solicitudes' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Inbox className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Solicitudes de registro</h3>
            </div>
            {requests.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">Sin solicitudes aún — comparte merco.edwsystem.com/registro</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {requests.map(r => (
                  <li key={r.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{r.companyName}</p>
                      <p className="text-xs text-gray-500">{r.contactName} · {r.email}{r.phone ? ` · ${r.phone}` : ''}</p>
                      {r.message && <p className="text-xs text-gray-400 mt-0.5 italic truncate">"{r.message}"</p>}
                      <p className="text-[11px] text-gray-400 mt-0.5">{new Date(r.createdAt).toLocaleString('es-CO')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {r.status === 'pending' ? (
                        <>
                          <button onClick={() => setApproveReq(r)} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">Aprobar</button>
                          <button onClick={() => handleRejectRequest(r.id)} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Rechazar</button>
                        </>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {section === 'pagos' && (<>
          {payCfg && (
            <form onSubmit={handleSavePayCfg} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Configuración de pagos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Llave Bre-B</label>
                  <input value={payCfg.brebKey} onChange={e => setPayCfg({ ...payCfg, brebKey: e.target.value })}
                    placeholder="@tullave / celular / cédula"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Titular</label>
                  <input value={payCfg.brebHolder} onChange={e => setPayCfg({ ...payCfg, brebHolder: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(['basic', 'pro', 'enterprise'] as const).map(pl => (
                  <div key={pl}>
                    <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">{PLAN_LABELS[pl]} (COP/mes)</label>
                    <input type="number" min="0" value={payCfg.prices[pl] ?? 0}
                      onChange={e => setPayCfg({ ...payCfg, prices: { ...payCfg.prices, [pl]: Number(e.target.value) } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-3">
                {payCfgMsg && <span className={`text-xs ${payCfgMsg.includes('guardada') ? 'text-green-600' : 'text-red-600'}`}>{payCfgMsg}</span>}
                <button type="submit" disabled={payCfgSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                  {payCfgSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          )}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Pagos de planes (Bre-B)</h3>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">Sin pagos reportados aún</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {payments.map(pg => (
                  <li key={pg.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {pg.tenant?.name ?? `Tenant #${pg.tenantId}`}
                        <span className="ml-2 font-normal text-gray-500">plan {pg.plan}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(pg.amount))}
                        {pg.reference ? ` · ref ${pg.reference}` : ''} · {new Date(pg.createdAt).toLocaleString('es-CO')}
                      </p>
                      {pg.receiptNumber && <p className="text-[11px] text-green-600 font-medium">Recibo {pg.receiptNumber}</p>}
                      {pg.rejectReason && <p className="text-[11px] text-red-500">Rechazado: {pg.rejectReason}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {pg.receiptMime && (
                        <button onClick={() => handleViewReceipt(pg)} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Comprobante</button>
                      )}
                      {pg.status === 'pending' ? (
                        <>
                          <button onClick={() => handleDecidePayment(pg.id, true)} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">Aprobar</button>
                          <button onClick={() => handleDecidePayment(pg.id, false)} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Rechazar</button>
                        </>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pg.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {pg.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>)}
      </div>

      {/* Aprobar solicitud */}
      {approveReq && (
        <ApproveRequestModal request={approveReq} onApprove={handleApproveRequest} onClose={() => setApproveReq(null)} />
      )}

      {/* Ver comprobante */}
      {payTenant && payCfg && (
        <RegisterPaymentModal
          tenant={payTenant}
          prices={payCfg.prices}
          onDone={() => { setPayTenant(null); load(); }}
          onClose={() => setPayTenant(null)}
        />
      )}

      {receiptView && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setReceiptView(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">
                Comprobante — {receiptView.payment.tenant?.name} ({new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(receiptView.payment.amount))})
              </p>
              <button onClick={() => setReceiptView(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            {receiptView.src ? (
              <img src={receiptView.src} alt="Comprobante de pago" className="w-full rounded-lg border border-gray-200" />
            ) : (
              <p className="text-sm text-gray-400 py-8 text-center">Sin comprobante adjunto</p>
            )}
            {receiptView.payment.status === 'pending' && (
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => handleDecidePayment(receiptView.payment.id, false)} className="px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Rechazar</button>
                <button onClick={() => handleDecidePayment(receiptView.payment.id, true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                  <Check className="w-3.5 h-3.5" /> Aprobar pago
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTenant && (
        <EditTenantModal
          tenant={editTenant}
          onSave={handleEdit}
          onClose={() => setEditTenant(null)}
        />
      )}

      {/* Detalle de tenant */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">{detail.tenant.name}</h3>
                <p className="text-xs text-gray-400 font-mono">{detail.tenant.slug} · desde {new Date(detail.tenant.createdAt).toLocaleDateString('es-CO')}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] text-gray-400">Plan</p>
                <p className="text-sm font-semibold text-gray-800">{PLAN_LABELS[detail.tenant.plan] ?? detail.tenant.plan}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] text-gray-400">Estado</p>
                <p className="text-sm font-semibold text-gray-800">{STATUS_LABELS[detail.tenant.status] ?? detail.tenant.status}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] text-gray-400">Cartera pendiente</p>
                <p className={`text-sm font-semibold ${detail.receivable > 0 ? 'text-amber-600' : 'text-gray-800'}`}>
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(detail.receivable)}
                </p>
              </div>
            </div>

            <p className="text-xs font-semibold text-gray-500 mb-2">Órdenes últimos 6 meses</p>
            {detail.ordersByMonth.length === 0 ? (
              <p className="text-xs text-gray-400 mb-5">Sin órdenes en el período</p>
            ) : (
              <div className="flex items-end gap-1.5 h-24 mb-5">
                {detail.ordersByMonth.map(m => {
                  const max = Math.max(...detail.ordersByMonth.map(x => x.count), 1);
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1" title={`${m.count} órdenes`}>
                      <span className="text-[10px] text-gray-500 font-medium">{m.count}</span>
                      <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(6, Math.round((m.count / max) * 52))}px` }} />
                      <span className="text-[10px] text-gray-400">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs font-semibold text-gray-500 mb-2">Usuarios ({detail.users.length})</p>
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 mb-5">
              {detail.users.map(u => (
                <div key={u.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-800">{u.username}</span>
                  <span className="text-xs text-gray-400 capitalize">{u.role} · {new Date(u.createdAt).toLocaleDateString('es-CO')}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => handleExport(detail.tenant.id, detail.tenant.slug)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Exportar datos
              </button>
              {detail.tenant.slug !== 'platform' && (
                <button
                  onClick={() => handleImpersonate(detail.tenant as unknown as TenantSummary)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" /> Entrar como admin
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Anuncio push */}
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
