import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Banknote, CreditCard, Landmark, MoreHorizontal, Plus, X, CheckCircle2, Printer } from 'lucide-react';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import { formatCurrency } from '../../utils/helpers';
import { PosPaymentLine, PosPaymentMethod, PosSaleResult } from '../../services/pos';

interface Props {
  isOpen: boolean;
  total: number;
  busy: boolean;
  /** Cuando hay resultado, el modal muestra la confirmación en vez del formulario de cobro */
  result?: PosSaleResult | null;
  printing?: boolean;
  onClose: () => void;
  onConfirm: (payments: PosPaymentLine[], cashReceived?: number) => void;
  onPrint?: () => void;
  /** Impresión directa (PC/navegador) — abre el diálogo nativo, sin generar PDF primero */
  onDirectPrint?: () => void;
  onDone?: () => void;
}

const METHOD_META: Record<PosPaymentMethod, { label: string; icon: React.ElementType }> = {
  cash: { label: 'Efectivo', icon: Banknote },
  card: { label: 'Tarjeta', icon: CreditCard },
  transfer: { label: 'Transferencia', icon: Landmark },
  other: { label: 'Otro', icon: MoreHorizontal },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Sugerencias de efectivo: el monto exacto y los siguientes montos redondos
// que suele entregar el cliente (billetes colombianos)
function quickCash(amount: number): number[] {
  if (!(amount > 0)) return [];
  const up = (step: number) => Math.ceil(amount / step) * step;
  const candidates = [amount, up(1000), up(5000), up(10000), up(50000), up(100000)];
  return [...new Set(candidates)].filter(v => v >= amount).slice(0, 5);
}

// Cobro del POS: por defecto una sola línea en efectivo por el total (flujo
// rápido de un clic); "Agregar método" habilita pago mixto. El campo
// "Efectivo recibido" solo aparece si hay una línea en efectivo y calcula
// el vuelto en vivo.
const PosPaymentModal: React.FC<Props> = ({ isOpen, total, busy, result, printing, onClose, onConfirm, onPrint, onDirectPrint, onDone }) => {
  const [lines, setLines] = useState<PosPaymentLine[]>([{ method: 'cash', amount: total }]);
  const [cashReceivedInput, setCashReceivedInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLines([{ method: 'cash', amount: total }]);
      setCashReceivedInput('');
    }
  }, [isOpen, total]);

  const paid = round2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
  const remaining = round2(total - paid);
  const cashLine = lines.find(l => l.method === 'cash');
  const cashReceived = cashReceivedInput === '' ? undefined : Number(cashReceivedInput);
  const change = cashLine && cashReceived !== undefined ? round2(cashReceived - cashLine.amount) : null;

  const availableMethods = (Object.keys(METHOD_META) as PosPaymentMethod[]).filter(
    m => !lines.some(l => l.method === m),
  );

  const setAmount = (idx: number, amount: number) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, amount } : l));

  const addLine = (method: PosPaymentMethod) => {
    setLines(prev => [...prev, { method, amount: Math.max(0, remaining) }]);
  };

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const canConfirm = Math.abs(remaining) < 0.01 && lines.every(l => l.amount > 0)
    && (!cashLine || cashReceived === undefined || cashReceived >= cashLine.amount - 0.01);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(lines, cashReceived);
  };

  if (result) {
    return (
      <Modal isOpen={isOpen} onClose={() => onDone?.()} title="Venta registrada">
        <div className="p-1 space-y-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{result.orderNumber}</p>
            <p className="text-3xl font-extrabold text-gray-900">{formatCurrency(result.totalAmount)}</p>
            {!!result.changeGiven && (
              <p className="mt-1 text-sm font-semibold text-emerald-600">Vuelto: {formatCurrency(result.changeGiven)}</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onPrint}
              disabled={printing}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {printing ? <LoadingSpinner size="sm" /> : <Printer className="w-4 h-4" />}
              {printing ? 'Generando…' : 'Imprimir ticket'}
            </button>
            <button
              onClick={() => onDone?.()}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-primary text-on-primary rounded-lg hover:bg-primary/90"
            >
              Nueva venta
            </button>
          </div>
          {onDirectPrint && !Capacitor.isNativePlatform() && (
            <button
              onClick={onDirectPrint}
              className="w-full text-xs text-gray-500 hover:text-gray-600 pt-1"
            >
              Imprimir directo en térmica (sin descargar PDF)
            </button>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cobrar">
      <div className="p-1 space-y-4">
        <div className="text-center">
          <p className="text-xs text-gray-600">Total a cobrar</p>
          <p className="text-3xl font-extrabold text-gray-900 tabular-nums">{formatCurrency(total)}</p>
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => {
            const meta = METHOD_META[line.method];
            const Icon = meta.icon;
            return (
              <div key={line.method} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
                <label htmlFor={`pay-${line.method}`} className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">{meta.label}</label>
                <input
                  id={`pay-${line.method}`}
                  type="number" min="0" value={line.amount}
                  onChange={e => setAmount(idx, Number(e.target.value))}
                  className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 rounded-lg text-base text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {lines.length > 1 && (
                  <button onClick={() => removeLine(idx)} aria-label={`Quitar ${meta.label}`}
                    className="w-10 h-10 -mr-2 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {availableMethods.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {availableMethods.map(m => {
              const meta = METHOD_META[m];
              const Icon = meta.icon;
              return (
                <button
                  key={m}
                  onClick={() => addLine(m)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-dashed border-gray-400 rounded-lg hover:bg-gray-50"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" /> <Icon className="w-4 h-4" aria-hidden="true" /> {meta.label}
                </button>
              );
            })}
          </div>
        )}

        {Math.abs(remaining) >= 0.01 && (
          <p className={`text-sm font-semibold text-center ${remaining > 0 ? 'text-amber-800' : 'text-red-600'}`}>
            {remaining > 0 ? `Falta ${formatCurrency(remaining)}` : `Sobran ${formatCurrency(-remaining)} — ajusta los montos`}
          </p>
        )}

        {cashLine && (
          <div className="pt-2 border-t border-gray-100">
            <label htmlFor="pay-received" className="block text-xs font-medium text-gray-700 mb-1">
              Efectivo recibido del cliente <span className="text-gray-600 font-normal">(para el vuelto)</span>
            </label>
            {/* Billetes rápidos: un toque en vez de digitar el monto */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {quickCash(cashLine.amount).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCashReceivedInput(String(v))}
                  aria-pressed={Number(cashReceivedInput) === v}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border tabular-nums ${
                    Number(cashReceivedInput) === v ? 'border-primary bg-primary/10 text-gray-900' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {v === cashLine.amount ? 'Exacto' : formatCurrency(v)}
                </button>
              ))}
            </div>
            <input
              id="pay-received"
              type="number" min="0" value={cashReceivedInput}
              onChange={e => setCashReceivedInput(e.target.value)}
              placeholder={String(cashLine.amount)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {change !== null && (
              change < 0
                ? <p className="mt-2 text-sm font-semibold text-red-700">El efectivo recibido no alcanza</p>
                : (
                  <div className="mt-2 flex items-baseline justify-between rounded-lg bg-emerald-50 px-3 py-2" aria-live="polite">
                    <span className="text-sm font-medium text-emerald-800">Vuelto</span>
                    <span className="text-2xl font-extrabold text-emerald-800 tabular-nums">{formatCurrency(change)}</span>
                  </div>
                )
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-3 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || busy}
            className="flex-1 px-4 py-3 text-sm font-semibold bg-primary text-on-primary rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Cobrando…' : 'Confirmar cobro'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PosPaymentModal;
