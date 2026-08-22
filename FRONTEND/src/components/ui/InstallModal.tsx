import React, { useState, useEffect } from 'react';
import {
  X, Download, Share, Plus, Monitor, Smartphone, Apple,
  BookOpen, Search, ShoppingCart, Package, Users, Tag,
  BarChart2, ChevronRight, CheckCircle,
} from 'lucide-react';

type Platform = 'ios' | 'android' | 'desktop' | 'installed';

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) return 'installed';
  if (isIOS) return 'ios';
  if (isAndroid) return 'android';
  return 'desktop';
}

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
  onInstalled?: () => void;
}

type Tab = 'install' | 'manual';

const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstalled,
}) => {
  const [tab, setTab] = useState<Tab>('install');
  const [platform] = useState<Platform>(detectPlatform);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (!isOpen) { setInstalled(false); setTab('install'); }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) { document.addEventListener('keydown', handler); document.body.style.overflow = 'hidden'; }
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    if (outcome === 'accepted') {
      setInstalled(true);
      onInstalled?.();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar — mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Merco</h2>
              <p className="text-xs text-gray-500">App de gestión de precios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          <button
            onClick={() => setTab('install')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              tab === 'install'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Download className="w-4 h-4" />
            Instalar
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              tab === 'manual'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Manual rápido
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 pb-safe">
          {tab === 'install' ? (
            <InstallTab
              platform={platform}
              deferredPrompt={deferredPrompt}
              installing={installing}
              installed={installed}
              onInstall={handleInstall}
            />
          ) : (
            <ManualTab />
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Install tab ─────────────────────────────────────────────────────────── */

interface InstallTabProps {
  platform: Platform;
  deferredPrompt: any;
  installing: boolean;
  installed: boolean;
  onInstall: () => void;
}

const InstallTab: React.FC<InstallTabProps> = ({
  platform, deferredPrompt, installing, installed, onInstall,
}) => {
  if (installed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">¡App instalada!</p>
          <p className="text-sm text-gray-500 mt-1">
            Merco ya está en tu pantalla de inicio. Puedes cerrar esta ventana.
          </p>
        </div>
      </div>
    );
  }

  if (platform === 'installed') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
        <div className="w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">Ya está instalada</p>
          <p className="text-sm text-gray-500 mt-1">
            Merco ya está instalada en este dispositivo como app.
          </p>
        </div>
      </div>
    );
  }

  if (platform === 'ios') return <IOSInstructions />;
  if (platform === 'android' || deferredPrompt) {
    return (
      <AndroidInstructions
        deferredPrompt={deferredPrompt}
        installing={installing}
        onInstall={onInstall}
      />
    );
  }
  return <DesktopInstructions />;
};

const IOSInstructions: React.FC = () => (
  <div className="px-5 py-5 space-y-5">
    <p className="text-sm text-gray-600 text-center">
      Sigue estos pasos para agregar Merco a tu pantalla de inicio en iPhone o iPad:
    </p>

    <div className="space-y-3">
      <Step n={1} icon={<Share className="w-5 h-5 text-primary" />} color="bg-primary/15">
        <p className="text-sm font-medium text-gray-900">Toca el botón Compartir</p>
        <p className="text-xs text-gray-500 mt-0.5">
          El ícono <span className="font-semibold">↑</span> en la barra inferior del navegador Safari
        </p>
      </Step>

      <Step n={2} icon={<Smartphone className="w-5 h-5 text-purple-600" />} color="bg-purple-100">
        <p className="text-sm font-medium text-gray-900">Desplázate y toca <span className="font-semibold">"Agregar a pantalla de inicio"</span></p>
        <p className="text-xs text-gray-500 mt-0.5">Busca el ícono con un cuadrado y una flecha hacia arriba</p>
      </Step>

      <Step n={3} icon={<Plus className="w-5 h-5 text-green-600" />} color="bg-green-100">
        <p className="text-sm font-medium text-gray-900">Toca <span className="font-semibold">"Agregar"</span> en la esquina superior derecha</p>
        <p className="text-xs text-gray-500 mt-0.5">La app aparecerá en tu pantalla de inicio como cualquier otra app</p>
      </Step>
    </div>

    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
      <Apple className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-700">
        Solo funciona desde <strong>Safari</strong>. Si estás usando Chrome u otro navegador en iOS, ábrelo en Safari primero.
      </p>
    </div>
  </div>
);

interface AndroidInstructionsProps {
  deferredPrompt: any;
  installing: boolean;
  onInstall: () => void;
}

const AndroidInstructions: React.FC<AndroidInstructionsProps> = ({
  deferredPrompt, installing, onInstall,
}) => (
  <div className="px-5 py-5 space-y-5">
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
        <Download className="w-8 h-8 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-gray-900">Instalar Merco</p>
        <p className="text-sm text-gray-500 mt-1">
          Accede rápido desde tu pantalla de inicio, sin abrir el navegador
        </p>
      </div>
    </div>

    {deferredPrompt ? (
      <button
        onClick={onInstall}
        disabled={installing}
        className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl font-semibold text-sm shadow-sm active:scale-95 transition-transform disabled:opacity-60"
      >
        {installing ? (
          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {installing ? 'Instalando…' : 'Instalar app'}
      </button>
    ) : (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 text-center">
          También puedes instalarla manualmente:
        </p>
        <Step n={1} icon={<Monitor className="w-5 h-5 text-primary" />} color="bg-primary/15">
          <p className="text-sm font-medium text-gray-900">Toca el menú <span className="font-semibold">⋮</span> del navegador</p>
        </Step>
        <Step n={2} icon={<Plus className="w-5 h-5 text-green-600" />} color="bg-green-100">
          <p className="text-sm font-medium text-gray-900">Selecciona <span className="font-semibold">"Agregar a pantalla de inicio"</span></p>
        </Step>
        <Step n={3} icon={<CheckCircle className="w-5 h-5 text-purple-600" />} color="bg-purple-100">
          <p className="text-sm font-medium text-gray-900">Confirma tocando <span className="font-semibold">"Agregar"</span></p>
        </Step>
      </div>
    )}

    <ul className="grid grid-cols-2 gap-2">
      {['Sin usar datos extra','Funciona offline','Rápida y fluida','Sin pasar por la tienda'].map(b => (
        <li key={b} className="flex items-center gap-1.5 text-xs text-gray-600">
          <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
          {b}
        </li>
      ))}
    </ul>
  </div>
);

const DesktopInstructions: React.FC = () => (
  <div className="px-5 py-5 space-y-5">
    <p className="text-sm text-gray-600 text-center">
      Instala Merco en tu computadora para acceso rápido desde el escritorio:
    </p>

    <div className="space-y-3">
      <Step n={1} icon={<Monitor className="w-5 h-5 text-primary" />} color="bg-primary/15">
        <p className="text-sm font-medium text-gray-900">Busca el ícono de instalación</p>
        <p className="text-xs text-gray-500 mt-0.5">
          En Chrome/Edge: ícono <span className="font-semibold">⊕</span> en la barra de dirección, a la derecha
        </p>
      </Step>

      <Step n={2} icon={<Download className="w-5 h-5 text-purple-600" />} color="bg-purple-100">
        <p className="text-sm font-medium text-gray-900">Haz clic en <span className="font-semibold">"Instalar"</span></p>
        <p className="text-xs text-gray-500 mt-0.5">Se abrirá una ventana para confirmar la instalación</p>
      </Step>

      <Step n={3} icon={<CheckCircle className="w-5 h-5 text-green-600" />} color="bg-green-100">
        <p className="text-sm font-medium text-gray-900">¡Listo! Ábrela desde el escritorio</p>
        <p className="text-xs text-gray-500 mt-0.5">Aparecerá como una app nativa en tu sistema</p>
      </Step>
    </div>

    <div className="bg-primary/10 border border-primary/25 rounded-xl p-3 flex gap-2">
      <Monitor className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <p className="text-xs text-primary">
        Compatible con <strong>Google Chrome</strong> y <strong>Microsoft Edge</strong>. En Safari para Mac, usa la opción "Archivo → Agregar al Dock".
      </p>
    </div>
  </div>
);

/* ─── Manual tab ──────────────────────────────────────────────────────────── */

const ManualTab: React.FC = () => {
  const sections = [
    {
      icon: <Search className="w-4 h-4 text-primary" />,
      color: 'bg-primary/15',
      title: 'Buscar y comparar precios',
      steps: [
        'Escribe el nombre del producto en el buscador principal',
        'Verás todos los proveedores con sus precios actuales',
        'El precio más bajo aparece resaltado en verde',
      ],
    },
    {
      icon: <Package className="w-4 h-4 text-purple-600" />,
      color: 'bg-purple-100',
      title: 'Productos y categorías',
      steps: [
        'Ve a "Productos" para ver el catálogo completo',
        'Usa filtros por categoría para encontrar más rápido',
        'Toca un producto para ver su historial de precios',
      ],
    },
    {
      icon: <Tag className="w-4 h-4 text-green-600" />,
      color: 'bg-green-100',
      title: 'Registrar precios',
      steps: [
        'Abre el producto y toca "Agregar precio"',
        'Selecciona el proveedor y escribe el precio',
        'El sistema guarda fecha y hora automáticamente',
      ],
    },
    {
      icon: <ShoppingCart className="w-4 h-4 text-orange-600" />,
      color: 'bg-orange-100',
      title: 'Órdenes de venta',
      steps: [
        'Ve a "Órdenes" y toca el botón +',
        'Busca y selecciona el cliente',
        'Agrega productos con cantidad y precio unitario',
        'Guarda: la orden queda en estado Pendiente',
      ],
    },
    {
      icon: <Users className="w-4 h-4 text-teal-600" />,
      color: 'bg-teal-100',
      title: 'Clientes',
      steps: [
        'Administra tus clientes en la sección "Clientes"',
        'Agrega nombre, NIT, teléfono y dirección',
        'Busca clientes por nombre o NIT rápidamente',
      ],
    },
    {
      icon: <BarChart2 className="w-4 h-4 text-rose-600" />,
      color: 'bg-rose-100',
      title: 'Modo offline',
      steps: [
        'La app funciona sin internet — crea órdenes offline',
        'Los datos se sincronizan al recuperar conexión',
        'Un punto naranja en el avatar indica elementos pendientes',
      ],
    },
  ];

  return (
    <div className="px-5 py-5 space-y-4">
      <p className="text-sm text-gray-500 text-center">
        Guía rápida de las funciones principales de Merco
      </p>
      {sections.map(s => (
        <details key={s.title} className="group border border-gray-200 rounded-xl overflow-hidden">
          <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-gray-50 transition-colors">
            <div className={`w-8 h-8 ${s.color} rounded-lg flex items-center justify-center shrink-0`}>
              {s.icon}
            </div>
            <span className="text-sm font-medium text-gray-900 flex-1">{s.title}</span>
            <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
          </summary>
          <div className="px-4 pb-4 pt-1">
            <ol className="space-y-2">
              {s.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-semibold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-600">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </details>
      ))}
    </div>
  );
};

/* ─── Step helper ─────────────────────────────────────────────────────────── */

const Step: React.FC<{ n: number; icon: React.ReactNode; color: string; children: React.ReactNode }> = ({
  n, icon, color, children,
}) => (
  <div className="flex items-start gap-3">
    <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center shrink-0`}>
      {icon}
    </div>
    <div className="flex-1 pt-1">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs font-bold text-gray-400">Paso {n}</span>
      </div>
      {children}
    </div>
  </div>
);

export default InstallModal;
