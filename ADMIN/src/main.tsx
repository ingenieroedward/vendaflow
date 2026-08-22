import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import './index.css';
import { useAuthStore } from './store/authStore';
import Superadmin from './pages/Superadmin';
import { apiService } from './services/api';
import { STORAGE_KEYS } from './utils/constants';

// Login exclusivo del superadmin: sin tenantSlug (este dominio no es un tenant)
const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await apiService.post<{ data: { token: string; user: { id: number; username: string; role: string; tenantId: number } } }>(
        '/auth/login', needsTotp ? { username, password, totp } : { username, password },
      );
      if (r.data.user.role !== 'superadmin') {
        setError('Este acceso es solo para el superadmin');
        setLoading(false);
        return;
      }
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, r.data.token);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(r.data.user));
      window.location.reload();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Credenciales incorrectas';
      if (msg === 'TOTP_REQUIRED') {
        // Contraseña correcta y 2FA activo — pedir el código
        setNeedsTotp(true);
        setError(null);
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-slate-800 rounded-2xl border border-white/10 p-8 space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white">Merco · Superadmin</h1>
          <p className="text-xs text-slate-400 mt-1">Acceso restringido a la administración de la plataforma</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Usuario</label>
          <input value={username} onChange={e => setUsername(e.target.value)} required autoFocus autoComplete="username"
            className="w-full px-3 py-2.5 bg-slate-900 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="relative">
          <label className="block text-xs font-medium text-slate-300 mb-1">Contraseña</label>
          <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
            className="w-full px-3 py-2.5 bg-slate-900 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="button" onClick={() => setShow(v => !v)} className="absolute right-2.5 bottom-2.5 text-slate-500 hover:text-slate-300">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {needsTotp && (
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Código de verificación (app autenticadora)</label>
            <input value={totp} onChange={e => setTotp(e.target.value)} required autoFocus inputMode="numeric" maxLength={7}
              placeholder="000000"
              className="w-full px-3 py-2.5 bg-slate-900 border border-blue-500/40 rounded-lg text-lg text-white text-center tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
};

const AdminApp: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const ok = isAuthenticated && user?.role === 'superadmin';
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={ok ? <Superadmin /> : <AdminLogin />} />
      </Routes>
    </BrowserRouter>
  );
};

// PWA: service worker propio del admin (push, sin cache offline)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {/* sin SW */});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>,
);
