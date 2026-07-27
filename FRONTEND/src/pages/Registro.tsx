import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Check, CheckCircle, Send, ShieldCheck, RefreshCw,
  ArrowRight, WifiOff, AlertTriangle, Mail, ClipboardList, KeyRound,
} from 'lucide-react';
import { apiService } from '../services/api';

interface Captcha { question: string; a: number; b: number; exp: number; token: string }

// Qué pasa después de enviar la solicitud — mismo lenguaje que los STEPS de la landing
const AFTER_STEPS = [
  { icon: ClipboardList, title: 'Envías tu solicitud', desc: 'Te toma 2 minutos. Sin tarjeta de crédito y sin llamadas de ventas.' },
  { icon: Package, title: 'Creamos tu espacio', desc: 'Montamos tu-empresa.merco.edwsystem.com con tus datos aislados y listos.' },
  { icon: KeyRound, title: 'Recibes tus accesos', desc: 'Te contactamos por correo o WhatsApp con tu usuario y 14 días con todo incluido.' },
];

const PERKS = [
  'Todas las funciones durante la prueba',
  'Funciona sin internet desde el día uno',
  'Soporte en español, en horario colombiano',
  'Cancelas cuando quieras, sin permanencia',
];

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-shadow';

const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';

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

  // ---------- Estado de éxito ----------
  if (sent) {
    return (
      <div className="min-h-screen bg-white text-gray-900 antialiased flex flex-col overflow-x-clip">
        <nav className="bg-white/85 backdrop-blur border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-gray-900">Merco</span>
            </Link>
            <a href="https://demo.merco.edwsystem.com" target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-semibold text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              Ver demo
            </a>
          </div>
        </nav>

        <main className="relative flex-1 flex items-center justify-center px-4 py-16">
          <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[44rem] h-[44rem] rounded-full bg-blue-50 blur-3xl opacity-70" />
          </div>

          <div className="max-w-lg w-full text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Solicitud enviada</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 leading-tight">
              Listo, quedó de nuestro lado
            </h1>
            <p className="mt-4 text-base text-gray-500 leading-relaxed">
              Revisamos tu solicitud, creamos el espacio de <span className="font-semibold text-gray-700">{form.companyName || 'tu empresa'}</span> y
              te contactamos muy pronto con tus accesos para arrancar los 14 días de prueba.
            </p>

            <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Mientras tanto</p>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                  <Mail className="w-[18px] h-[18px] text-blue-600" />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Mantén el ojo en tu correo{form.email ? <> (<span className="font-semibold text-gray-800 break-all">{form.email}</span>)</> : ''} y
                  en WhatsApp: por ahí te llegan los accesos. Si quieres ir abriendo boca, la demo está andando.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="https://demo.merco.edwsystem.com" target="_blank" rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25">
                Explorar la demo en vivo <ArrowRight className="w-4 h-4" />
              </a>
              <Link to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                Volver al inicio
              </Link>
            </div>
            <p className="mt-6 text-xs text-gray-400">
              ¿Ya tienes cuenta? <Link to="/login" className="text-blue-600 font-semibold hover:underline underline-offset-2">Inicia sesión</Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ---------- Formulario ----------
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased overflow-x-clip">
      {/* Nav mínima, consistente con la landing */}
      <nav className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">Merco</span>
          </Link>
          <div className="flex items-center gap-2">
            <a href="https://demo.merco.edwsystem.com" target="_blank" rel="noopener noreferrer"
              className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              Ver demo
            </a>
            <Link to="/login" className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Inicia sesión
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative">
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-40 left-1/3 -translate-x-1/2 w-[48rem] h-[48rem] rounded-full bg-blue-50 blur-3xl opacity-70" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20 grid lg:grid-cols-[1fr_minmax(0,30rem)] gap-12 lg:gap-16 items-start">
          {/* ---------- Columna de valor ---------- */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Prueba gratis de 14 días</p>
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-gray-900 leading-[1.1]">
              Deja el cuaderno.
              <span className="block text-blue-600">Empieza hoy mismo.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-500 leading-relaxed max-w-xl">
              Cuéntanos de tu distribuidora y nosotros nos encargamos del resto.
              Así funciona después de que envías la solicitud:
            </p>

            {/* Los 3 pasos, con la línea visual de la landing */}
            <div className="mt-9 space-y-7">
              {AFTER_STEPS.map((s, i) => (
                <div key={s.title} className="relative flex items-start gap-4">
                  {i < AFTER_STEPS.length - 1 && (
                    <div className="absolute left-6 top-12 bottom-[-1.75rem] w-px bg-gray-200" aria-hidden="true" />
                  )}
                  <div className="relative w-12 h-12 shrink-0 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/25">
                    <s.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="pt-1">
                    <p className="text-base font-bold text-gray-900">
                      <span className="text-blue-600 tabular-nums mr-1.5">{i + 1}.</span>{s.title}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 leading-relaxed max-w-md">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Beneficios con checks */}
            <ul className="mt-10 grid sm:grid-cols-2 gap-x-6 gap-y-2.5 max-w-xl">
              {PERKS.map(p => (
                <li key={p} className="flex items-start gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" /> {p}
                </li>
              ))}
            </ul>

            {/* Eco offline de la landing */}
            <div className="mt-10 hidden lg:flex items-center gap-4 rounded-2xl bg-slate-900 px-6 py-5 max-w-xl">
              <WifiOff className="w-6 h-6 text-blue-400 shrink-0" />
              <p className="text-sm text-slate-300">
                <span className="font-bold text-white">¿Zona de mala señal?</span> Merco fue construido para eso:
                tus vendedores siguen facturando sin conexión.
              </p>
            </div>
          </div>

          {/* ---------- Formulario ---------- */}
          <div className="w-full">
            <form onSubmit={submit}
              className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-slate-900/5 p-6 sm:p-8 space-y-5">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-gray-900">Solicita tu prueba</h2>
                <p className="mt-1 text-sm text-gray-500">Sin tarjeta de crédito. Te respondemos el mismo día hábil.</p>
              </div>

              <div>
                <label htmlFor="reg-company" className={labelCls}>Nombre de tu empresa *</label>
                <input id="reg-company" name="companyName" value={form.companyName} onChange={handle} required maxLength={255}
                  placeholder="Distribuciones La 14" className={inputCls} />
              </div>
              <div>
                <label htmlFor="reg-name" className={labelCls}>Tu nombre *</label>
                <input id="reg-name" name="contactName" value={form.contactName} onChange={handle} required maxLength={255}
                  placeholder="María Pérez" className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-4">
                <div>
                  <label htmlFor="reg-email" className={labelCls}>Correo *</label>
                  <input id="reg-email" type="email" name="email" value={form.email} onChange={handle} required maxLength={255}
                    placeholder="maria@empresa.com" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="reg-phone" className={labelCls}>WhatsApp / Teléfono</label>
                  <input id="reg-phone" name="phone" value={form.phone} onChange={handle} maxLength={50}
                    placeholder="300 123 4567" className={inputCls} />
                </div>
              </div>
              <div>
                <label htmlFor="reg-message" className={labelCls}>
                  Cuéntanos de tu negocio <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <textarea id="reg-message" name="message" value={form.message} onChange={handle} rows={2} maxLength={1000}
                  placeholder="Distribuimos abarrotes, ~200 clientes..."
                  className={`${inputCls} resize-none`} />
              </div>

              {/* Honeypot invisible para bots */}
              <input
                type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)}
                tabIndex={-1} autoComplete="off" aria-hidden="true"
                className="absolute -left-[9999px] top-0 h-0 w-0 opacity-0"
              />

              {/* Verificación anti-bots, integrada como un campo más */}
              <div>
                <label htmlFor="reg-captcha" className={`${labelCls} flex items-center gap-1.5`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Verificación rápida *
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white pl-3.5 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 transition-shadow">
                  <span className="text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap shrink-0">
                    {captcha ? captcha.question : 'cargando...'}
                  </span>
                  <input
                    id="reg-captcha" type="number" inputMode="numeric" value={answer}
                    onChange={e => setAnswer(e.target.value)} required
                    placeholder="Respuesta"
                    className="flex-1 min-w-0 bg-transparent border-0 px-2 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  />
                  <button type="button" onClick={loadCaptcha} aria-label="Cambiar pregunta de verificación"
                    className="shrink-0 w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 px-3.5 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button type="submit" disabled={sending || !captcha}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:shadow-none">
                <Send className="w-4 h-4" />
                {sending ? 'Enviando...' : 'Solicitar mi prueba gratis'}
              </button>

              <p className="text-center text-xs text-gray-400">
                Sin tarjeta de crédito · Listo en minutos · Cancela cuando quieras
              </p>
            </form>

            <p className="mt-5 text-center text-xs text-gray-400">
              ¿Ya eres cliente? Ingresa desde <span className="font-mono text-gray-500">tu-empresa.merco.edwsystem.com</span>
              {' '}o <Link to="/login" className="text-blue-600 font-semibold hover:underline underline-offset-2">inicia sesión</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Registro;
