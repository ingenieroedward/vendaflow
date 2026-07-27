import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, CheckCircle, Send } from 'lucide-react';
import { apiService } from '../services/api';

interface Captcha { question: string; a: number; b: number; exp: number; token: string }

// Solicitud pública de registro — el superadmin aprueba y crea el tenant
const Registro: React.FC = () => {
  const [form, setForm] = useState({ companyName: '', contactName: '', email: '', phone: '', message: '' });
  const [website, setWebsite] = useState(''); // honeypot
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [answer, setAnswer] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCaptcha = () => {
    apiService.get<Captcha>('/onboarding/captcha').then(setCaptcha).catch(() => setCaptcha(null));
  };
  useEffect(loadCaptcha, []);

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captcha) { setError('Verificación no cargada — recarga la página'); return; }
    setSending(true);
    setError(null);
    try {
      await apiService.post('/onboarding/request', {
        ...form,
        phone: form.phone || undefined,
        message: form.message || undefined,
        website,
        captcha: { a: captcha.a, b: captcha.b, exp: captcha.exp, token: captcha.token, answer: Number(answer) },
      });
      setSent(true);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'No se pudo enviar la solicitud');
      loadCaptcha();
      setAnswer('');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">¡Solicitud recibida!</h1>
          <p className="text-sm text-gray-500 mb-6">
            Gracias por tu interés en Merco. Revisaremos tu solicitud y te contactaremos muy pronto para activar tu período de prueba.
          </p>
          <Link to="/login" className="text-sm text-blue-600 hover:underline">Volver al inicio de sesión</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-10 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Package className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Prueba Merco gratis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de precios, ventas, inventario y cartera para tu distribuidora. Déjanos tus datos y activamos tu prueba.
          </p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre de tu empresa *</label>
            <input name="companyName" value={form.companyName} onChange={handle} required maxLength={255}
              placeholder="Distribuciones La 14"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tu nombre *</label>
            <input name="contactName" value={form.contactName} onChange={handle} required maxLength={255}
              placeholder="María Pérez"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Correo *</label>
              <input type="email" name="email" value={form.email} onChange={handle} required maxLength={255}
                placeholder="maria@empresa.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">WhatsApp / Teléfono</label>
              <input name="phone" value={form.phone} onChange={handle} maxLength={50}
                placeholder="300 123 4567"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cuéntanos de tu negocio <span className="text-gray-400">(opcional)</span></label>
            <textarea name="message" value={form.message} onChange={handle} rows={2} maxLength={1000}
              placeholder="Distribuimos abarrotes, ~200 clientes..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Honeypot invisible para bots */}
          <input
            type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)}
            tabIndex={-1} autoComplete="off" aria-hidden="true"
            className="absolute -left-[9999px] top-0 h-0 w-0 opacity-0"
          />

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Verificación: {captcha?.question ?? 'cargando...'}
            </label>
            <input
              type="number" value={answer} onChange={e => setAnswer(e.target.value)} required
              placeholder="Tu respuesta"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={sending || !captcha}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
            <Send className="w-4 h-4" />
            {sending ? 'Enviando...' : 'Solicitar mi prueba gratis'}
          </button>

          <p className="text-center text-xs text-gray-400">
            ¿Ya tienes cuenta? <Link to="/login" className="text-blue-600 hover:underline">Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Registro;
