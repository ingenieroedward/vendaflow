import React, { useState, useEffect } from 'react';
import { User as UserIcon, Save, Shield, KeyRound } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { usersService } from '../services/users';
import ChangePasswordModal from '../components/features/ChangePasswordModal';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  seller: 'Vendedor',
  buyer: 'Comprador',
};

const Profile: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const { addNotification } = useUIStore();
  const [form, setForm] = useState({ name: '', username: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);

  useEffect(() => {
    usersService.getProfile()
      .then(u => {
        setForm({ name: u.name ?? '', username: u.username });
        setUser(u); // por si el nombre cambió desde otro dispositivo
      })
      .catch(() => {
        // sin conexión o error puntual — el formulario sigue usable con lo
        // que ya había en el store (login/sesión previa)
        if (user) setForm({ name: user.name ?? '', username: user.username });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await usersService.updateProfile({
        name: form.name.trim() || undefined,
        username: form.username.trim(),
      });
      setUser(updated);
      addNotification({ type: 'success', message: 'Perfil actualizado' });
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'No se pudo guardar el perfil');
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
        <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-primary/70 to-primary rounded-full flex items-center justify-center shadow-sm">
          <UserIcon className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 px-2">Mi perfil</h1>
        <p className="text-sm sm:text-lg text-gray-600 px-2">Tus datos de acceso a Merco.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-1">
            <UserIcon className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Datos personales</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo</label>
            <input
              name="name" value={form.name} onChange={handle}
              placeholder="Opcional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Usuario</label>
            <input
              name="username" value={form.username} onChange={handle} required minLength={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <p className="mt-1 text-[11px] text-gray-400">Es lo que usas para iniciar sesión.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              <Shield className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              {user ? (ROLE_LABELS[user.role] ?? user.role) : '—'}
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Solo un administrador puede cambiar tu rol.</p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-700">Contraseña</span>
          </div>
          <button
            type="button"
            onClick={() => setPwdOpen(true)}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cambiar contraseña
          </button>
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

      <ChangePasswordModal isOpen={pwdOpen} onClose={() => setPwdOpen(false)} />
    </div>
  );
};

export default Profile;
