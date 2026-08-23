import React, { useState } from 'react';
import { KeyRound, Copy, Check, AlertTriangle } from 'lucide-react';
import { tenantAdminService, PlatformSettings, ALL_FEATURES, FEATURE_LABELS } from '../../services/tenantAdmin';
import { PLAN_LABELS } from '../../utils/adminHelpers';

// Modal de códigos de respaldo — se usa tanto al activar el 2FA como al
// regenerar. El texto plano solo existe en este instante (el backend nunca
// lo vuelve a devolver), así que insiste en que se guarden ya.
const BackupCodesModal: React.FC<{ codes: string[]; onClose: () => void }> = ({ codes, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard no disponible — el usuario los copia a mano */ }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-gray-900">Guarda estos códigos ahora</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              No se van a volver a mostrar. Cada uno sirve una sola vez, para entrar si pierdes el
              acceso a tu app autenticadora.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-800">
          {codes.map(c => <div key={c} className="select-all">{c}</div>)}
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyAll}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar todos'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            Ya los guardé
          </button>
        </div>
      </div>
    </div>
  );
};

// Configuración de la plataforma (Bre-B, precios/features por plan, 2FA de
// la propia cuenta) — todo esto se toca una vez al mes o menos, separado a
// propósito de Bandeja (que sí es trabajo diario/frecuente).
const Configuracion: React.FC<{
  payCfg: PlatformSettings | null;
  onPayCfgChange: (cfg: PlatformSettings) => void;
  totpEnabled: boolean | null;
  onTotpEnabledChange: (v: boolean) => void;
  totpBackupRemaining: number | null;
  onTotpBackupRemainingChange: (n: number | null) => void;
}> = ({ payCfg, onPayCfgChange, totpEnabled, onTotpEnabledChange, totpBackupRemaining, onTotpBackupRemainingChange }) => {
  const [payCfgSaving, setPayCfgSaving] = useState(false);
  const [payCfgMsg, setPayCfgMsg] = useState<string | null>(null);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpMsg, setTotpMsg] = useState<string | null>(null);
  const [revealCodes, setRevealCodes] = useState<string[] | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenCode, setRegenCode] = useState('');

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

  const handleTotpStart = async () => {
    setTotpMsg(null);
    try { setTotpSetup(await tenantAdminService.totpSetup()); setTotpCode(''); }
    catch (e: unknown) { setTotpMsg((e as { message?: string })?.message ?? 'Error'); }
  };

  const handleTotpEnable = async () => {
    if (!totpSetup) return;
    setTotpMsg(null);
    try {
      const { backupCodes } = await tenantAdminService.totpEnable(totpSetup.secret, totpCode);
      onTotpEnabledChange(true);
      onTotpBackupRemainingChange(backupCodes.length);
      setTotpSetup(null); setTotpCode('');
      setTotpMsg('2FA activado — desde ahora el login pedirá el código');
      setRevealCodes(backupCodes);
    } catch (e: unknown) { setTotpMsg((e as { message?: string })?.message ?? 'Código incorrecto'); }
  };

  const handleTotpDisable = async () => {
    const code = window.prompt('Para desactivar el 2FA, escribe el código actual de tu app autenticadora (o un código de respaldo):');
    if (!code) return;
    setTotpMsg(null);
    try {
      await tenantAdminService.totpDisable(code);
      onTotpEnabledChange(false);
      onTotpBackupRemainingChange(null);
      setTotpMsg('2FA desactivado');
    } catch (e: unknown) { setTotpMsg((e as { message?: string })?.message ?? 'Código incorrecto'); }
  };

  const handleRegenerate = async () => {
    setTotpMsg(null);
    try {
      const { backupCodes } = await tenantAdminService.totpBackupRegenerate(regenCode);
      onTotpBackupRemainingChange(backupCodes.length);
      setRegenerating(false); setRegenCode('');
      setRevealCodes(backupCodes);
    } catch (e: unknown) { setTotpMsg((e as { message?: string })?.message ?? 'Código incorrecto'); }
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
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>
                {totpBackupRemaining ?? 0} código{totpBackupRemaining === 1 ? '' : 's'} de respaldo restante{totpBackupRemaining === 1 ? '' : 's'}
                {totpBackupRemaining !== null && totpBackupRemaining <= 2 && (
                  <span className="ml-1.5 text-amber-600 font-medium">— se están agotando</span>
                )}
              </span>
              {!regenerating && (
                <button onClick={() => setRegenerating(true)} className="text-blue-600 hover:underline font-medium">
                  Regenerar
                </button>
              )}
            </div>
            {regenerating && (
              <div className="space-y-2 bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600">
                  Esto invalida los códigos de respaldo anteriores. Escribe el código actual de tu app
                  autenticadora para confirmar:
                </p>
                <div className="flex gap-2">
                  <input value={regenCode} onChange={e => setRegenCode(e.target.value)} inputMode="numeric" maxLength={7} placeholder="000000"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={handleRegenerate} disabled={regenCode.length < 6}
                    className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    Regenerar
                  </button>
                  <button onClick={() => { setRegenerating(false); setRegenCode(''); }}
                    className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
                </div>
              </div>
            )}
            <button onClick={handleTotpDisable}
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
              Desactivar 2FA
            </button>
          </div>
        )}
        {totpMsg && <p className="mt-2 text-xs font-medium text-blue-700">{totpMsg}</p>}
      </div>

      {revealCodes && <BackupCodesModal codes={revealCodes} onClose={() => setRevealCodes(null)} />}
    </>
  );
};

export default Configuracion;
