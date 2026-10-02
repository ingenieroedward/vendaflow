import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import { usersService } from '../../services/users';
import { useUIStore } from '../../store/uiStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Cambio de contraseña propia — disponible para todos los roles
const ChangePasswordModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addNotification } = useUIStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCurrent(''); setNext(''); setConfirm(''); setError(null); setShow(false);
  };

  const close = () => { reset(); onClose(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 6) { setError('La nueva contraseña debe tener al menos 6 caracteres'); return; }
    if (next !== confirm) { setError('Las contraseñas nuevas no coinciden'); return; }
    setSaving(true);
    try {
      await usersService.changePassword(current, next);
      addNotification({ type: 'success', message: 'Contraseña actualizada correctamente' });
      close();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'No se pudo cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary';

  return (
    <Modal isOpen={isOpen} onClose={close} title="Cambiar contraseña">
      <form onSubmit={submit} className="space-y-4 p-1">
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          <KeyRound className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span>Por seguridad, confirma tu contraseña actual antes de elegir la nueva.</span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Contraseña actual</label>
          <input
            type={show ? 'text' : 'password'}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            className={inputCls}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nueva contraseña</label>
          <input
            type={show ? 'text' : 'password'}
            value={next}
            onChange={e => setNext(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirmar nueva contraseña</label>
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {show ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
        </button>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <LoadingSpinner size="sm" /> : <KeyRound className="w-4 h-4" />}
            {saving ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
