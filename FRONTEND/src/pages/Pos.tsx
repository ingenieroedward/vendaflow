import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingCart, Plus, Minus, Trash2, Search, DoorOpen, DoorClosed, Package } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useProductStore } from '../store/productStore';
import { useTenantStore } from '../store/tenantStore';
import { useUIStore } from '../store/uiStore';
import { posService, CashSession, PosPaymentLine, PosSaleResult } from '../services/pos';
import { orderService } from '../services/orders';
import { Order } from '../types/order';
import { formatCurrency } from '../utils/helpers';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Modal from '../components/ui/Modal';
import PosPaymentModal from '../components/features/PosPaymentModal';
import OrderPrintView from '../components/features/OrderPrintView';

interface CartLine {
  productId: number;
  name: string;
  code: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  stock: number;
}

// Punto de venta de mostrador — Fase 4: lector de código de barras (el
// buscador recupera el foco solas veces que sea necesario; Enter agrega
// directo si hay un match exacto de código o un único resultado). Fases
// 1-3: caja, venta simple, pago mixto con vueltos y cierre real.
//
// Nota de alcance (ver PLAN-FEATURES-Y-POS.md): el refuerzo offline de la
// Fase 4 queda deliberadamente fuera de esta entrega — requiere replicar la
// maquinaria de sincronización de Orders (IndexedDB, clientRef, cola) para
// un endpoint con forma distinta (sesión de caja, pagos mixtos, vueltos), y
// apurarlo arriesga bugs de doble cobro en un sistema que maneja dinero. Se
// deja como tarea propia, con su propio diseño, en vez de simularla a medias.
const Pos: React.FC = () => {
  const { products, getProducts } = useProductStore();
  const { addNotification } = useUIStore();

  const [session, setSession] = useState<CashSession | null | undefined>(undefined); // undefined = cargando
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingBusy, setOpeningBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [saleResult, setSaleResult] = useState<PosSaleResult | null>(null);
  const [saleOrder, setSaleOrder] = useState<Order | null>(null); // orden completa, para el ticket
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeResult, setCloseResult] = useState<CashSession | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const refreshSession = () => posService.getCurrentSession().then(setSession).catch(() => setSession(null));

  useEffect(() => {
    getProducts(1, 2000, false);
    refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getProducts]);

  useEffect(() => { if (session) searchRef.current?.focus(); }, [session]);
  // Recuperar el foco cuando se cierran los modales — un lector de código de
  // barras "escribe" en el input que tenga el foco; si se pierde, el
  // siguiente escaneo no llega a ningún lado.
  useEffect(() => { if (!paymentModalOpen && !closeModalOpen) searchRef.current?.focus(); }, [paymentModalOpen, closeModalOpen]);

  // Productos más vendidos en esta caja (contador local por negocio), para
  // que la grilla no arranque vacía: se vende con un toque sin escribir
  const { tenant } = useTenantStore();
  const freqKey = `pos_freq_${tenant?.id ?? 'x'}`;
  const readFreq = (): Record<string, number> => {
    try { return JSON.parse(localStorage.getItem(freqKey) || '{}'); } catch { return {}; }
  };
  const [freq, setFreq] = useState<Record<string, number>>(readFreq);
  const bumpFreq = (items: { productId: number; quantity: number }[]) => {
    const next = { ...readFreq() };
    for (const it of items) next[it.productId] = (next[it.productId] ?? 0) + 1;
    try { localStorage.setItem(freqKey, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
    setFreq(next);
  };

  const quickPicks = useMemo(() => {
    const sold = products
      .filter(p => (freq[p.id] ?? 0) > 0)
      .sort((a, b) => (freq[b.id] ?? 0) - (freq[a.id] ?? 0));
    const rest = products
      .filter(p => !(freq[p.id] > 0))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return { items: [...sold, ...rest].slice(0, 12), hasSold: sold.length > 0 };
  }, [products, freq]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quickPicks.items;
    return products
      .filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      .slice(0, 30);
  }, [search, products, quickPicks]);

  // Un lector de código de barras es solo un teclado rápido que termina con
  // Enter. Si el texto coincide EXACTO con un código, agrega directo sin
  // esperar a que el cajero haga clic; con un único resultado por nombre
  // también (atajo cómodo); con varios, deja que elija visualmente.
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const q = search.trim().toLowerCase();
    if (!q) return;
    const exact = products.find(p => p.code.toLowerCase() === q);
    if (exact) { e.preventDefault(); addToCart(exact); return; }
    if (results.length === 1) { e.preventDefault(); addToCart(results[0]); }
  };

  const total = useMemo(() => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [cart]);

  const addToCart = (p: { id: number; name: string; code: string; unit: string; salePrice: number; stock: number }) => {
    setCart(prev => {
      const existing = prev.find(l => l.productId === p.id);
      if (existing) {
        return prev.map(l => l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, { productId: p.id, name: p.name, code: p.code, unit: p.unit, unitPrice: p.salePrice, quantity: 1, stock: p.stock }];
    });
    setSearch('');
    searchRef.current?.focus();
  };

  const setQty = (productId: number, quantity: number) => {
    if (quantity <= 0) { setCart(prev => prev.filter(l => l.productId !== productId)); return; }
    setCart(prev => prev.map(l => l.productId === productId ? { ...l, quantity } : l));
    searchRef.current?.focus(); // los botones +/- del carrito no deben robarle el foco al lector
  };

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(openingAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      addNotification({ type: 'error', title: 'Monto inválido' });
      return;
    }
    setOpeningBusy(true);
    try {
      // openSession devuelve la fila cruda (sin salesByMethod) — se
      // refresca con getCurrentSession para tener la forma completa
      await posService.openSession(amount);
      await refreshSession();
      setOpeningAmount('');
    } catch (err: unknown) {
      addNotification({ type: 'error', title: 'No se pudo abrir la caja', message: (err as { message?: string })?.message });
    } finally {
      setOpeningBusy(false);
    }
  };

  const handleConfirmPayment = async (payments: PosPaymentLine[], cashReceived?: number) => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      const sale = await posService.sale(
        cart.map(l => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: 0 })),
        payments,
        cashReceived,
      );
      bumpFreq(cart);
      setCart([]);
      setSaleResult(sale); // el modal pasa a mostrar la confirmación (con ticket opcional)
      getProducts(1, 2000, false); // refresca stock
      refreshSession(); // refresca el desglose por método del turno
      // Orden completa (con items/cliente) para el ticket — no bloquea la confirmación si falla
      orderService.getOrderById(sale.id).then(setSaleOrder).catch(() => setSaleOrder(null));
    } catch (err: unknown) {
      addNotification({ type: 'error', title: 'No se pudo cobrar', message: (err as { message?: string })?.message });
    } finally {
      setCheckingOut(false);
    }
  };

  // Ticket 80mm — mismo mecanismo (html2canvas + jsPDF) que OrderDetail usa
  // para Orders, ya probado en producción.
  const handlePrintTicket = async () => {
    if (!saleOrder || !printRef.current) return;
    setPrinting(true);
    try {
      const el = printRef.current;
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff',
        windowWidth: el.scrollWidth, windowHeight: el.scrollHeight, scrollX: 0, scrollY: 0,
      });
      const ticketWidthMm = 80;
      const ticketHeightMm = (canvas.height / canvas.width) * ticketWidthMm;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [ticketWidthMm, ticketHeightMm] });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, ticketWidthMm, ticketHeightMm);
      const fileName = `${saleOrder.orderNumber}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const base64 = pdf.output('datauristring').split(',')[1];
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({ title: `Venta ${fileName}`, url: uri });
      } else {
        pdf.save(fileName);
      }
    } catch {
      addNotification({ type: 'error', title: 'No se pudo generar el ticket' });
    } finally {
      setPrinting(false);
    }
  };

  // Impresión directa (PC/navegador) — mismo mecanismo que OrderDetail: abre
  // el diálogo nativo del sistema ya con el ticket formateado, sin generar/
  // descargar un PDF primero. Ver .print-ticket-root en index.css.
  const handleDirectPrintTicket = () => {
    if (!saleOrder) return;
    window.print();
  };

  const handleNewSale = () => {
    setPaymentModalOpen(false);
    setSaleResult(null);
    setSaleOrder(null);
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const amount = Number(countedCash);
    if (!Number.isFinite(amount) || amount < 0) {
      addNotification({ type: 'error', title: 'Monto inválido' });
      return;
    }
    setCloseBusy(true);
    try {
      const closed = await posService.closeSession(session.id, amount);
      setCloseResult(closed);
    } catch (err: unknown) {
      addNotification({ type: 'error', title: 'No se pudo cerrar la caja', message: (err as { message?: string })?.message });
    } finally {
      setCloseBusy(false);
    }
  };

  const finishClosing = () => {
    setCloseModalOpen(false);
    setCloseResult(null);
    setCountedCash('');
    setSession(null);
    setCart([]);
  };

  // ── Cargando sesión ──────────────────────────────────────────────────────
  if (session === undefined) {
    return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  }

  // ── Sin caja abierta: pedir monto inicial ───────────────────────────────
  if (!session) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <DoorOpen className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Abrir caja</h1>
          <p className="text-sm text-gray-500 mt-1">Declara el efectivo con el que arrancas el turno.</p>
        </div>
        <form onSubmit={handleOpenSession} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <label htmlFor="pos-opening" className="block text-xs font-medium text-gray-700 mb-1">Base inicial (efectivo)</label>
            <input
              id="pos-opening"
              type="number" min="0" autoFocus value={openingAmount}
              onChange={e => setOpeningAmount(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button type="submit" disabled={openingBusy}
            className="w-full py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {openingBusy ? 'Abriendo…' : 'Abrir caja'}
          </button>
        </form>
      </div>
    );
  }

  // ── Caja abierta: pantalla de venta ─────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Punto de venta</h1>
          <p className="text-xs text-gray-500">
            Caja abierta con {formatCurrency(Number(session.openingAmount))} · {new Date(session.openedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            {session.salesByMethod.total > 0 && <> · {formatCurrency(session.salesByMethod.total)} vendido en el turno</>}
          </p>
        </div>
        <button
          onClick={() => setCloseModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <DoorClosed className="w-4 h-4" /> Cerrar caja
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Buscador + resultados */}
        <div className="lg:col-span-2">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
            <input
              ref={searchRef}
              aria-label="Buscar producto o escanear código"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Busca por nombre, código o escanea…"
              className="w-full pl-9 pr-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {search.trim() === '' && results.length > 0 && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
              {quickPicks.hasSold ? 'Más vendidos en esta caja' : 'Productos'}
            </p>
          )}
          {search.trim() === '' && results.length === 0 ? (
            <div className="text-center py-16 text-gray-600 text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 text-gray-500" aria-hidden="true" />
              No hay productos para vender todavía
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16 text-gray-600 text-sm">Sin resultados para "{search}"</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {results.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-left bg-white border border-gray-200 rounded-xl p-3 hover:border-primary/60 hover:shadow-sm transition-all"
                >
                  <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5 font-mono">{p.code}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-primary">{formatCurrency(p.salePrice)}</span>
                    <span className={`text-xs font-medium ${p.stock <= 0 ? 'text-red-700' : 'text-gray-600'}`}>
                      {p.stock <= 0 ? 'Sin stock' : `${p.stock} ${p.unit}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-fit sticky top-4">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Carrito</h2>
            {cart.length > 0 && <span className="ml-auto text-xs text-gray-600">{cart.length} producto{cart.length !== 1 ? 's' : ''}</span>}
          </div>
          {cart.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-10 px-4">Agrega productos buscándolos a la izquierda</p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100">
              {cart.map(l => (
                <div key={l.productId} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 leading-tight flex-1">{l.name}</p>
                    <button onClick={() => setQty(l.productId, 0)} aria-label={`Quitar ${l.name}`}
                      className="-mr-2 -mt-2 w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1.5">
                      {/* 44px: se opera con el dedo en mostrador (antes 24px) */}
                      <button onClick={() => setQty(l.productId, l.quantity - 1)} aria-label={`Quitar una unidad de ${l.name}`}
                        className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-base font-semibold text-gray-900 min-w-[2rem] text-center tabular-nums" aria-live="polite">{l.quantity}</span>
                      <button onClick={() => setQty(l.productId, l.quantity + 1)} aria-label={`Agregar una unidad de ${l.name}`}
                        className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(l.unitPrice * l.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Total</span>
              <span className="text-xl font-extrabold text-gray-900 tabular-nums">{formatCurrency(total)}</span>
            </div>
            <button
              onClick={() => setPaymentModalOpen(true)}
              disabled={cart.length === 0}
              className="w-full py-3 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Cobrar
            </button>
          </div>
        </div>
      </div>

      <PosPaymentModal
        isOpen={paymentModalOpen}
        total={total}
        busy={checkingOut}
        result={saleResult}
        printing={printing}
        onClose={() => setPaymentModalOpen(false)}
        onConfirm={handleConfirmPayment}
        onPrint={handlePrintTicket}
        onDirectPrint={handleDirectPrintTicket}
        onDone={handleNewSale}
      />

      {/* Portal a #print-root (hermano de #root en index.html) — igual que
          OrderDetail.tsx: en pantalla oculto (posición fuera de vista) y
          sigue sirviendo para la captura html2canvas del PDF; al imprimir
          directo, .print-ticket-root pasa a flujo normal ahí. */}
      {saleOrder && createPortal(
        <div className="print-ticket-root" style={{ position: 'absolute', left: '-9999px', top: 0, width: '302px', pointerEvents: 'none' }}>
          <OrderPrintView ref={printRef} order={saleOrder} />
        </div>,
        document.getElementById('print-root') ?? document.body
      )}

      {/* Cerrar caja */}
      <Modal isOpen={closeModalOpen} onClose={() => { if (!closeResult) setCloseModalOpen(false); }} title="Cerrar caja">
        {!closeResult ? (
          <form onSubmit={handleCloseSession} className="space-y-4 p-1">
            {session.salesByMethod.total > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Ventas del turno</p>
                {([
                  ['Efectivo', session.salesByMethod.cash],
                  ['Tarjeta', session.salesByMethod.card],
                  ['Transferencia', session.salesByMethod.transfer],
                  ['Otro', session.salesByMethod.other],
                ] as const).filter(([, amt]) => amt > 0).map(([label, amt]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(amt)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm pt-1.5 border-t border-gray-200">
                  <span className="font-medium text-gray-600">Efectivo esperado en caja</span>
                  <span className="font-bold text-gray-900">{formatCurrency(Number(session.openingAmount) + session.salesByMethod.cash)}</span>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500">Cuenta el efectivo físico en caja y escribe el total.</p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Efectivo contado</label>
              <input
                type="number" min="0" autoFocus value={countedCash}
                onChange={e => setCountedCash(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCloseModalOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={closeBusy}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {closeBusy ? 'Cerrando…' : 'Cerrar caja'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-1 space-y-4 text-center">
            <p className="text-sm text-gray-500">Caja cerrada</p>
            <div className={`text-3xl font-extrabold ${Number(closeResult.difference) === 0 ? 'text-gray-900' : Number(closeResult.difference)! > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {Number(closeResult.difference) === 0 ? 'Cuadrado' : formatCurrency(Number(closeResult.difference))}
            </div>
            <p className="text-xs text-gray-500">
              Esperado {formatCurrency(Number(closeResult.expectedCash))} · Contado {formatCurrency(Number(closeResult.countedCash))}
            </p>
            <button onClick={finishClosing}
              className="w-full py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:bg-primary/90">
              Listo
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Pos;
