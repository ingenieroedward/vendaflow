import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, TrendingUp, ClipboardList, Warehouse, WifiOff, Smartphone,
  Check, ArrowRight, BarChart2, MapPin, ShieldCheck, Zap, ChevronDown,
  CircleDollarSign, AlertTriangle, Clock,
} from 'lucide-react';
import { apiService } from '../services/api';

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const FEATURES = [
  { icon: TrendingUp, title: 'Compara precios de proveedores', desc: 'Registra lo que te cobra cada proveedor por producto y compra siempre al que te dé mejor precio. Se acabó adivinar.' },
  { icon: ClipboardList, title: 'Órdenes y cartera al día', desc: 'Vende de contado o fiado con plazo, y deja que el sistema te recuerde a quién cobrarle y cuándo.' },
  { icon: Warehouse, title: 'Inventario sin sorpresas', desc: 'Stock en tiempo real, alertas cuando un producto se está acabando y órdenes de compra a tus proveedores.' },
  { icon: BarChart2, title: 'Informes que sí se entienden', desc: 'Ventas, compras, utilidad y cartera en gráficas claras. Sabes cómo va el negocio sin pedirle el cuaderno a nadie.' },
  { icon: WifiOff, title: 'Funciona sin internet', desc: 'Se fue la señal y sigues facturando. Cuando vuelve la conexión, todo se sincroniza solo.' },
  { icon: Smartphone, title: 'App en el celular de tu equipo', desc: 'Se instala en Android, iPhone o computador. En el plan Pro, con tu propio logo y colores.' },
];

const STEPS = [
  { num: '1', title: 'Crea tu cuenta', desc: 'Registras tu distribuidora en menos de 5 minutos. Sin tarjeta de crédito, sin papeleo, sin llamadas de ventas.' },
  { num: '2', title: 'Carga tus productos y clientes', desc: 'Montas tu catálogo, tus proveedores con sus precios y tus clientes. Tu equipo entra con su propio usuario y permisos.' },
  { num: '3', title: 'Vende y cobra con control', desc: 'Tomas pedidos desde el celular, incluso sin señal. La cartera, el inventario y los informes se actualizan solos.' },
];

const TRUST = [
  { icon: MapPin, label: 'Hecho en Colombia', sub: 'Precios en pesos y soporte en español' },
  { icon: WifiOff, label: 'Funciona sin internet', sub: 'Sigue vendiendo aunque se caiga la señal' },
  { icon: ShieldCheck, label: 'Tus datos son tuyos', sub: 'Cada empresa con su información aislada' },
  { icon: Zap, label: 'Listo en minutos', sub: 'Sin instalaciones ni técnicos a domicilio' },
];

const FAQS = [
  { q: '¿Necesito internet para trabajar?', a: 'No todo el tiempo. Merco funciona sin conexión: tomas pedidos, consultas productos y registras clientes offline. Cuando vuelve la señal, todo se sincroniza automáticamente.' },
  { q: '¿Cómo se paga?', a: 'Tienes 14 días gratis con todas las funciones. Cuando decidas quedarte, pagas mes a mes por Bre-B o transferencia. Sin contratos de permanencia: cancelas cuando quieras.' },
  { q: '¿Sirve para mi equipo de vendedores?', a: 'Sí. Cada vendedor entra con su usuario desde el celular, toma pedidos en la calle y tú ves todo en tiempo real. Los permisos separan lo que ve cada quien: ventas, compras o administración.' },
  { q: '¿Qué pasa con la información de mi negocio?', a: 'Cada empresa tiene sus datos completamente separados de las demás, con respaldos diarios automáticos. Tus precios, clientes y cartera son solo tuyos.' },
];

const PLAN_META: Record<string, { name: string; desc: string; features: string[]; highlight?: boolean }> = {
  basic: { name: 'Básico', desc: 'Para arrancar', features: ['3 usuarios', '500 productos', '200 órdenes/mes', 'Soporte por WhatsApp'] },
  pro: { name: 'Pro', desc: 'El más elegido', features: ['10 usuarios', '5.000 productos', '1.000 órdenes/mes', 'App con tu marca', 'Soporte prioritario'], highlight: true },
  enterprise: { name: 'Enterprise', desc: 'Sin límites', features: ['Usuarios ilimitados', 'Productos ilimitados', 'Órdenes ilimitadas', 'Acompañamiento dedicado'] },
};

// ---------- Mockup del producto (solo Tailwind, sin imágenes) ----------

const CarteraMockup: React.FC = () => (
  <div className="relative select-none" aria-hidden="true">
    {/* Ventana principal: vista de cartera */}
    <div className="rounded-2xl bg-white border border-gray-200 shadow-2xl shadow-slate-900/10 overflow-hidden">
      {/* Chrome de la ventana */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-900">
        <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
        <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
        <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
        <span className="ml-3 text-[11px] font-medium text-slate-400 truncate">tu-empresa.merco.edwsystem.com</span>
      </div>
      {/* Encabezado de la vista */}
      <div className="px-4 sm:px-5 pt-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Cartera</p>
          <p className="text-sm font-bold text-gray-900">Cuentas por cobrar</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Sincronizado
        </span>
      </div>
      {/* KPIs */}
      <div className="px-4 sm:px-5 pt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
          <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1"><CircleDollarSign className="w-3 h-3" />Por cobrar</p>
          <p className="text-xs sm:text-sm font-extrabold text-gray-900 tabular-nums">$12.450.000</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
          <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />Órdenes</p>
          <p className="text-xs sm:text-sm font-extrabold text-gray-900 tabular-nums">18</p>
        </div>
        <div className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2">
          <p className="text-[10px] font-medium text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Vencidas</p>
          <p className="text-xs sm:text-sm font-extrabold text-red-600 tabular-nums">3</p>
        </div>
      </div>
      {/* Lista de clientes */}
      <div className="px-4 sm:px-5 py-4 space-y-2">
        {[
          { name: 'Tienda La Esquina', due: 'Vencida hace 4 días', amt: '$1.860.000', tone: 'red' },
          { name: 'Supermercado El Ahorro', due: 'Vence en 3 días', amt: '$3.240.000', tone: 'amber' },
          { name: 'Distribuciones Karen', due: 'Vence en 12 días', amt: '$2.150.000', tone: 'emerald' },
          { name: 'Autoservicio Central', due: 'Vence en 20 días', amt: '$5.200.000', tone: 'emerald' },
        ].map(r => (
          <div key={r.name} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{r.name}</p>
              <p className={`text-[10px] font-medium ${
                r.tone === 'red' ? 'text-red-600' : r.tone === 'amber' ? 'text-amber-600' : 'text-emerald-600'
              }`}>{r.due}</p>
            </div>
            <p className="text-xs font-bold text-gray-900 tabular-nums shrink-0">{r.amt}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Card flotante: comparación de precios */}
    <div className="absolute -bottom-6 -left-2 sm:-left-6 w-[220px] sm:w-[250px] rounded-xl bg-white border border-gray-200 shadow-xl shadow-slate-900/10 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Mejor precio</p>
      <p className="text-xs font-bold text-gray-900 mb-2.5">Arroz Diana x 25 kg</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-emerald-800">Surtimax Mayorista</span>
          <span className="text-[11px] font-bold text-emerald-700 tabular-nums">$98.500</span>
        </div>
        <div className="flex items-center justify-between px-2.5 py-1">
          <span className="text-[11px] text-gray-500">Distribuidora Norte</span>
          <span className="text-[11px] text-gray-500 tabular-nums">$103.200</span>
        </div>
        <div className="flex items-center justify-between px-2.5 py-1">
          <span className="text-[11px] text-gray-500">Almacén El Punto</span>
          <span className="text-[11px] text-gray-500 tabular-nums">$106.900</span>
        </div>
      </div>
    </div>

    {/* Chip flotante: modo offline */}
    <div className="absolute -top-3 right-2 sm:-right-4 inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white px-3 py-1.5 shadow-lg">
      <WifiOff className="w-3 h-3 text-blue-400" />
      <span className="text-[10px] font-semibold">Funciona sin señal</span>
    </div>
  </div>
);

// Landing pública del dominio raíz — los tenants entran por su subdominio
const Landing: React.FC = () => {
  const [prices, setPrices] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    apiService.post('/onboarding/track', { event: 'landing_view' }).catch(() => {});
    apiService.get<{ prices: Record<string, number> }>('/onboarding/plans')
      .then(r => setPrices(r.prices)).catch(() => setPrices(null));
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased overflow-x-clip">
      {/* ---------- Nav ---------- */}
      <nav className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">Merco</span>
          </a>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-600">
            <a href="#funciones" className="hover:text-gray-900 transition-colors">Funciones</a>
            <a href="#como-funciona" className="hover:text-gray-900 transition-colors">Cómo funciona</a>
            <a href="#planes" className="hover:text-gray-900 transition-colors">Planes</a>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://demo.merco.edwsystem.com" target="_blank" rel="noopener noreferrer"
              className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              Ver demo
            </a>
            <Link to="/registro" className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              Prueba gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ---------- Hero ---------- */}
      <header className="relative">
        {/* Fondo decorativo */}
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[52rem] h-[52rem] rounded-full bg-blue-50 blur-3xl opacity-70" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-20 sm:pb-28 grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold rounded-full mb-6">
              <MapPin className="w-3 h-3" />
              Para distribuidoras y mayoristas en Colombia
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight text-gray-900 leading-[1.08]">
              El negocio en el cuaderno
              <span className="block text-blue-600">se te está escapando</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-gray-500 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Merco te muestra a quién cobrarle, a quién comprarle más barato y cuánto
              estás ganando de verdad. Precios, ventas, cartera e inventario en un solo
              lugar — incluso sin internet.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
              <Link to="/registro" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25">
                Empieza tu prueba de 14 días <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="https://demo.merco.edwsystem.com" target="_blank" rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                Ver demo en vivo
              </a>
            </div>
            <p className="mt-4 text-xs text-gray-400">Sin tarjeta de crédito · Listo en minutos · Cancela cuando quieras</p>
          </div>

          {/* Mockup */}
          <div className="px-3 sm:px-6 lg:px-0 pt-4 lg:pt-0 pb-8">
            <CarteraMockup />
          </div>
        </div>
      </header>

      {/* ---------- Franja de confianza ---------- */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {TRUST.map(t => (
            <div key={t.label} className="flex items-start gap-3">
              <div className="w-9 h-9 shrink-0 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                <t.icon className="w-[18px] h-[18px] text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">{t.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Funciones ---------- */}
      <section id="funciones" className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Funciones</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
            Todo lo que tu operación necesita, nada que te sobre
          </h2>
          <p className="mt-4 text-gray-500">
            Sin módulos que nunca vas a usar. Merco hace bien lo que una distribuidora necesita todos los días.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="group bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:border-blue-200 hover:shadow-md transition-all">
              <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                <f.icon className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Cómo funciona ---------- */}
      <section id="como-funciona" className="bg-slate-900 relative overflow-hidden">
        <div className="absolute -top-40 right-0 w-[36rem] h-[36rem] rounded-full bg-blue-600/10 blur-3xl" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24 relative">
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">Cómo funciona</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Del cuaderno al control total en tres pasos
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10 md:gap-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-14 right-0 h-px bg-slate-700" aria-hidden="true" />
                )}
                <div className="relative w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-5 shadow-lg shadow-blue-600/30">
                  <span className="text-lg font-extrabold text-white tabular-nums">{s.num}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-slate-700/60 bg-slate-800/50 px-6 py-5">
            <WifiOff className="w-6 h-6 text-blue-400 shrink-0" />
            <p className="text-sm text-slate-300 text-center sm:text-left">
              <span className="font-bold text-white">¿Zona de mala señal?</span> Merco fue construido para eso:
              tus vendedores toman pedidos sin conexión y todo se sincroniza cuando vuelve el internet.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Planes ---------- */}
      <section id="planes" className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Planes</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
            Precios claros, en pesos colombianos
          </h2>
          <p className="mt-4 text-gray-500">
            Empieza gratis 14 días con todas las funciones. Paga por Bre-B cuando estés listo. Sin permanencia.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto items-stretch">
          {(['basic', 'pro', 'enterprise'] as const).map(key => {
            const meta = PLAN_META[key]!;
            const dark = !!meta.highlight;
            return (
              <div key={key}
                className={`relative flex flex-col rounded-2xl p-6 ${
                  dark
                    ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/25 sm:-my-3 sm:py-9'
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}>
                {dark && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-full whitespace-nowrap">
                    EL MÁS ELEGIDO
                  </span>
                )}
                <h3 className={`text-base font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{meta.name}</h3>
                <p className={`text-xs mb-5 ${dark ? 'text-slate-400' : 'text-gray-400'}`}>{meta.desc}</p>
                <p className={`text-3xl font-extrabold tracking-tight tabular-nums ${dark ? 'text-white' : 'text-gray-900'}`}>
                  {prices ? COP(prices[key] ?? 0) : '—'}
                  <span className={`text-sm font-medium ${dark ? 'text-slate-400' : 'text-gray-400'}`}> /mes</span>
                </p>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {meta.features.map(ft => (
                    <li key={ft} className={`flex items-start gap-2 text-sm ${dark ? 'text-slate-300' : 'text-gray-600'}`}>
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${dark ? 'text-blue-400' : 'text-emerald-500'}`} /> {ft}
                    </li>
                  ))}
                </ul>
                <Link to="/registro"
                  className={`mt-7 block text-center px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                    dark
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}>
                  Probar gratis
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-10 text-center text-xs text-gray-400">
          Todos los planes incluyen modo sin internet, cartera con recordatorios de cobro y respaldos diarios.
        </p>
      </section>

      {/* ---------- Preguntas frecuentes ---------- */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 text-center mb-10">
            Preguntas frecuentes
          </h2>
          <div className="space-y-3">
            {FAQS.map(f => (
              <details key={f.q} className="group bg-white rounded-xl border border-gray-200 shadow-sm open:shadow-md transition-shadow">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-bold text-gray-900">{f.q}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-sm text-gray-500 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA final ---------- */}
      <section className="bg-slate-900 relative overflow-hidden">
        <div className="absolute -bottom-48 left-1/2 -translate-x-1/2 w-[44rem] h-[44rem] rounded-full bg-blue-600/15 blur-3xl" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center relative">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight max-w-2xl mx-auto">
            ¿Te deben plata y no sabes cuánto?
          </h2>
          <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Con Merco ves tu cartera al día y el sistema le recuerda el cobro a ti y a tus
            vendedores, antes de que la deuda se vuelva vieja.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/registro" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30">
              Empezar mi prueba gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="https://demo.merco.edwsystem.com" target="_blank" rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-sm font-semibold text-slate-300 border border-slate-700 rounded-xl hover:bg-slate-800 hover:text-white transition-colors">
              Ver demo en vivo
            </a>
          </div>
          <p className="mt-5 text-xs text-slate-500">14 días gratis · Sin tarjeta de crédito · Soporte en español</p>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold text-gray-900">Merco</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a href="#funciones" className="hover:text-gray-900 transition-colors">Funciones</a>
              <a href="#planes" className="hover:text-gray-900 transition-colors">Planes</a>
              <a href="https://demo.merco.edwsystem.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">Demo</a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} Merco · Desarrollado en Colombia por{' '}
              <a href="https://edwsystem.com" className="hover:text-gray-600 underline-offset-2 hover:underline">EDW System</a>
            </p>
            <p className="text-xs text-gray-400">
              ¿Ya eres cliente? Ingresa desde <span className="font-mono text-gray-500">tu-empresa.merco.edwsystem.com</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
