import React, { useState } from 'react';
import { Receipt, KeyRound, FileText, Check, X } from 'lucide-react';
import { tenantAdminService, PlatformSettings, PlanPaymentItem, ALL_FEATURES, FEATURE_LABELS } from '../../services/tenantAdmin';
import { PLAN_LABELS } from '../../utils/adminHelpers';

const Pagos: React.FC<{
  payCfg: PlatformSettings | null;
  onPayCfgChange: (cfg: PlatformSettings) => void;
  payments: PlanPaymentItem[];
  onPaymentsChange: (p: PlanPaymentItem[]) => void;
  onReload: () => Promise<void>;
  totpEnabled: boolean | null;
  onTotpEnabledChange: (v: boolean) => void;
  onError: (msg: string) => void;
}> = ({ payCfg, onPayCfgChange, payments, onPaymentsChange, onReload, totpEnabled, onTotpEnabledChange, onError }) => {
  const [payCfgSaving, setPayCfgSaving] = useState(false);
  const [payCfgMsg, setPayCfgMsg] = useState<string | null>(null);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpMsg, setTotpMsg] = useState<string | null>(null);
  const [receiptView, setReceiptView] = useState<{ payment: PlanPaymentItem; src: string | null } | null>(null);

  const handleSavePayCfg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCfg) return;
    setPayCfgSaving(true);
    setPayCfgMsg(null);
    try {
      onPayCfgChange(await tenantAdminService.updatePlatformSettings(payCfg));
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
    } catch (e: unknown) { onError((e as { message?: string })?.message ?? 'Error'); }
  };

  const handleDecidePayment = async (id: number, approve: boolean) => {
    try {
      if (approve) await tenantAdminService.approvePayment(id);
      else await tenantAdminService.rejectPayment(id, prompt('Motivo del rechazo (opcional):') ?? undefined);
      setReceiptView(null);
      await onReload();
      onPaymentsChange(await tenantAdminService.listPayments());
    } catch (e: unknown) { onError((e as { message?: string })?.message ?? 'Error'); }
  };

  const handleTotpStart = async () => {
    setTotpMsg(null);
    try { setTotpSetup(await tenantAdminService.totpSetup()); setTotpCode(''); }
    catch (e: unknown) { setTotpMsg((e as { message?: string })?.message ?? 'Error'); }
  };

  const handleTotpEnable = async () => {
    if (!totpSetup) return;
    setTotpMsg(null);
    try {
      await tenantAdminService.totpEnable(totpSetup.secret, totpCode);
      onTotpEnabledChange(true); setTotpSetup(null); setTotpCode('');
      setTotpMsg('2FA activado — desde ahora el login pedirá el código');
    } catch (e: unknown) { setTotpMsg((e as { message?: string })?.message ?? 'Código incorrecto'); }
  };

  const handleTotpDisable = async () => {
    const code = window.prompt('Para desactivar el 2FA, escribe el código actual de tu app autenticadora:');
    if (!code) return;
    setTotpMsg(null);
    try { await tenantAdminService.totpDisable(code); onTotpEnabledChange(false); setTotpMsg('2FA desactivado'); }
    catch (e: unknown) { setTotpMsg((e as { message?: string })?.message ?? 'Código incorrecto'); }
  };

  return (
    <>
      {payCfg && (
        <form onSubmit={handleSavePayCfg} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Configuración de pagos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Llave Bre-B</label>
              <input value={payCfg.brebKey} onChange={e => onPayCfgChange({ ...payCfg, brebKey: e.target.value })}
                placeholder="@tullave / celular / cédula"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Titular</label>
              <input value={payCfg.brebHolder} onChange={e => onPayCfgChange({ ...payCfg, brebHolder: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(['basic', 'pro', 'enterprise'] as const).map(pl => (
              <div key={pl}>
                <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">{PLAN_LABELS[pl]} (COP/mes)</label>
                <input type="number" min="0" value={payCfg.prices[pl] ?? 0}
                  onChange={e => onPayCfgChange({ ...payCfg, prices: { ...payCfg.prices, [pl]: Number(e.target.value) } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-700 mb-2">Funciones incluidas por plan</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="font-medium pb-1.5 pr-3">Función</th>
                    {(['trial', 'basic', 'pro', 'enterprise'] as const).map(pl => (
                      <th key={pl} className="font-medium pb-1.5 px-2 text-center capitalize">{PLAN_LABELS[pl] ?? pl}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_FEATURES.map(feature => (
                    <tr key={feature} className="border-t border-gray-50">
                      <td className="py-2 pr-3 text-gray-700">{FEATURE_LABELS[feature] ?? feature}</td>
                      {(['trial', 'basic', 'pro', 'enterprise'] as const).map(pl => {
                        const checked = payCfg.planFeatures[pl]?.includes(feature) ?? false;
                        return (
                          <td key={pl} className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                const list = new Set(payCfg.planFeatures[pl] ?? []);
                                if (e.target.checked) list.add(feature); else list.delete(feature);
                                onPayCfgChange({ ...payCfg, planFeatures: { ...payCfg.planFeatures, [pl]: [...list] } });
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      {/* Seguridad: 2FA de la cuenta superadmin */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Verificación en dos pasos (2FA)</h3>
          {totpEnabled != null && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${totpEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {totpEnabled ? 'Activo' : 'Inactivo'}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Protege esta cuenta (que administra todos los tenants y registra pagos) con un código de una app
          autenticadora — Google Authenticator, Authy o 1Password.
        </p>
        {!totpEnabled && !totpSetup && (
          <button onClick={handleTotpStart}
            className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800">
            Activar 2FA
          </button>
        )}
        {totpSetup && (
          <div className="space-y-3 bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600">
              1. En tu app autenticadora elige <b>agregar cuenta → entrada manual</b> y pega esta clave
              (cuenta: <b>Merco</b>):
            </p>
            <p className="font-mono text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 break-all select-all">{totpSetup.secret}</p>
            <p className="text-xs text-gray-600">2. Escribe el código de 6 dígitos que te muestra la app:</p>
            <div className="flex gap-2">
              <input value={totpCode} onChange={e => setTotpCode(e.target.value)} inputMode="numeric" maxLength={7} placeholder="000000"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleTotpEnable} disabled={totpCode.length < 6}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                Confirmar y activar
              </button>
              <button onClick={() => { setTotpSetup(null); setTotpCode(''); }}
                className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
            </div>
          </div>
        )}
        {totpEnabled && (
          <button onClick={handleTotpDisable}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
            Desactivar 2FA
          </button>
        )}
        {totpMsg && <p className="mt-2 text-xs font-medium text-blue-700">{totpMsg}</p>}
      </div>

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
                  {pg.receiptNumber && (
                    <p className="text-[11px] text-green-600 font-medium">
                      Recibo {pg.receiptNumber}
                      {pg.receiptUrl && (
                        <a href={pg.receiptUrl} target="_blank" rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-0.5 text-blue-600 hover:underline font-semibold">
                          <FileText className="w-3 h-3" /> Ver recibo
                        </a>
                      )}
                    </p>
                  )}
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
    </>
  );
};

export default Pagos;
