import React, { useState } from 'react';
import { tenantAdminService, TenantSummary } from '../services/tenantAdmin';
import { PLAN_LABELS } from '../utils/adminHelpers';

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

export default RegisterPaymentModal;
