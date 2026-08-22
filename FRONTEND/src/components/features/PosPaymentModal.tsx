import React, { useEffect, useState } from 'react';
import { Banknote, CreditCard, Landmark, MoreHorizontal, Plus, X } from 'lucide-react';
import Modal from '../ui/Modal';
import { formatCurrency } from '../../utils/helpers';
import { PosPaymentLine, PosPaymentMethod } from '../../services/pos';

interface Props {
  isOpen: boolean;
  total: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payments: PosPaymentLine[], cashReceived?: number) => void;
}

const METHOD_META: Record<PosPaymentMethod, { label: string; icon: React.ElementType }> = {
  cash: { label: 'Efectivo', icon: Banknote },
  card: { label: 'Tarjeta', icon: CreditCard },
  transfer: { label: 'Transferencia', icon: Landmark },
  other: { label: 'Otro', icon: MoreHorizontal },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Cobro del POS: por defecto una sola línea en efectivo por el total (flujo
// rápido de un clic); "Agregar método" habilita pago mixto. El campo
// "Efectivo recibido" solo aparece si hay una línea en efectivo y calcula
// el vuelto en vivo.
const PosPaymentModal: React.FC<Props> = ({ isOpen, total, busy, onClose, onConfirm }) => {
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cobrar">
      <div className="p-1 space-y-4">
        <div className="text-center">
          <p className="text-xs text-gray-500">Total a cobrar</p>
          <p className="text-3xl font-extrabold text-gray-900">{formatCurrency(total)}</p>
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => {
            const meta = METHOD_META[line.method];
            const Icon = meta.icon;
            return (
              <div key={line.method} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">{meta.label}</span>
                <input
                  type="number" min="0" value={line.amount}
                  onChange={e => setAmount(idx, Number(e.target.value))}
                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {lines.length > 1 && (
                  <button onClick={() => removeLine(idx)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
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
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-500 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Plus className="w-3 h-3" /> <Icon className="w-3 h-3" /> {meta.label}
                </button>
              );
            })}
          </div>
        )}

        {Math.abs(remaining) >= 0.01 && (
          <p className={`text-sm font-semibold text-center ${remaining > 0 ? 'text-amber-600' : 'text-red-600'}`}>
            {remaining > 0 ? `Falta ${formatCurrency(remaining)}` : `Sobran ${formatCurrency(-remaining)} — ajusta los montos`}
          </p>
        )}

        {cashLine && (
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Efectivo recibido del cliente <span className="text-gray-400 font-normal">(para el vuelto)</span>
            </label>
            <input
              type="number" min="0" value={cashReceivedInput}
              onChange={e => setCashReceivedInput(e.target.value)}
              placeholder={String(cashLine.amount)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {change !== null && (
              <p className={`mt-1.5 text-sm font-semibold ${change < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {change < 0 ? 'El efectivo recibido no alcanza' : `Vuelto: ${formatCurrency(change)}`}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || busy}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Cobrando…' : 'Confirmar cobro'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PosPaymentModal;
