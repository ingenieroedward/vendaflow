import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Edit, Trash2, Calendar, User,
  WifiOff, RefreshCw, AlertCircle, CloudOff, CheckCircle2, Clock,
  RotateCcw, AlertTriangle, FileText, RotateCw
} from "lucide-react";
import { useQuoteStore } from "../store/quoteStore";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { quoteService, searchQuotesServer } from "../services/quotes";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import SegmentedTabs from '../components/ui/SegmentedTabs';
import ErrorMessage from "../components/ui/ErrorMessage";
import Button from "../components/ui/Button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Quote, QuoteItem } from "../types/quote";
import { db, SyncStatus, LocalQuote } from "../database/LocalDatabase";

type TabType = 'active' | 'closed' | 'local' | 'trash';

const CLOSED_STATUSES: Quote['status'][] = ['converted', 'rejected', 'expired'];

interface LocalQuoteMeta {
  quote: LocalQuote;
  customerName?: string;
  attempts: number;
  errorMsg?: string;
  lastAttemptAt?: number;
}

const STATUS_LABEL: Record<Quote['status'], string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  expired: 'Vencida',
  converted: 'Convertida',
};

const STATUS_COLOR: Record<Quote['status'], string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-sky-100 text-sky-900',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-amber-100 text-amber-800',
  converted: 'bg-emerald-100 text-emerald-800',
};

const Quotes: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const { quotes, loading, error, pagination, getQuotes, loadMoreQuotes, clearError, deleteQuote, syncPendingQuotes, retryConflictQuote, pendingSync } =
    useQuoteStore();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<number | null>(null);

  // Local tab state
  const [localQuotes, setLocalQuotes] = useState<LocalQuoteMeta[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [localDeleteConfirm, setLocalDeleteConfirm] = useState<number | null>(null);

  // Trash tab state
  const [trashList, setTrashList] = useState<Quote[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<number | null>(null);

  // Búsqueda en servidor (cubre cotizaciones no cargadas en la página actual)
  const [serverResults, setServerResults] = useState<Quote[] | null>(null);
  useEffect(() => {
    if (!navigator.onLine || search.trim().length < 2) { setServerResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await searchQuotesServer(search.trim());
        setServerResults(r);
      } catch { setServerResults(null); }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { getQuotes(1, 50); }, [getQuotes]);

  const loadLocalQuotes = useCallback(async () => {
    setLoadingLocal(true);
    try {
      const pending = await db.quotes
        .filter(q => q._syncStatus !== SyncStatus.SYNCED && !q.deletedAt)
        .reverse()
        .toArray();

      const withMeta: LocalQuoteMeta[] = await Promise.all(pending.map(async q => {
        const queueEntry = await db.syncQueue
          .where('entityLocalId').equals(q.id!)
          .filter(e => e.entityType === 'quote')
          .first();
        const customer = await db.customers.get(q.customerId)
          ?? await db.customers.where('serverId').equals(q.customerId).first();
        return {
          quote: q,
          customerName: customer?.name,
          attempts: queueEntry?.attempts ?? 0,
          errorMsg: queueEntry?.error,
          lastAttemptAt: queueEntry?.lastAttemptAt,
        };
      }));

      setLocalQuotes(withMeta);
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'local') loadLocalQuotes();
  }, [activeTab, loadLocalQuotes]);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    try {
      const deleted = await quoteService.getDeletedQuotes();
      setTrashList(deleted);
    } finally {
      setTrashLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'trash') loadTrash();
  }, [activeTab, loadTrash]);

  const handleRestore = async (id: number) => {
    try {
      await quoteService.restoreQuote(id);
      addNotification({ type: 'success', title: 'Cotización restaurada', message: 'La cotización volvió a la lista activa.' });
      loadTrash();
      getQuotes();
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo restaurar la cotización.' });
    }
  };

  const handleHardDelete = async (id: number) => {
    try {
      await quoteService.hardDeleteQuote(id);
      addNotification({ type: 'success', title: 'Eliminada definitivamente', message: 'La cotización fue eliminada de forma permanente.' });
      setHardDeleteConfirm(null);
      loadTrash();
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar la cotización.' });
    }
  };

  const handleRefresh = () => getQuotes(pagination.page, 50);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const { synced, failed } = await syncPendingQuotes();
      if (synced > 0) {
        addNotification({ type: 'success', title: 'Sincronizado', message: `${synced} cotización${synced > 1 ? 'es' : ''} enviada${synced > 1 ? 's' : ''} al servidor` });
        getQuotes();
      } else if (failed > 0) {
        addNotification({ type: 'error', title: 'Error al sincronizar', message: `${failed} cotización${failed > 1 ? 'es' : ''} fallaron. Ver tab Pendientes para detalles.` });
      } else {
        addNotification({ type: 'info', title: 'Sin pendientes', message: 'No hay cotizaciones pendientes de sincronizar' });
      }
      if (activeTab === 'local') loadLocalQuotes();
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryConflict = async (localId: number) => {
    setSyncing(true);
    try {
      await retryConflictQuote(localId);
      if (navigator.onLine) {
        await syncPendingQuotes();
        loadLocalQuotes();
        getQuotes();
      } else {
        loadLocalQuotes();
      }
      addNotification({ type: 'info', title: 'Reintentando', message: 'Cotización reseteada. Se enviará al reconectar.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteLocal = async (localId: number) => {
    await db.quoteItems.where('quoteId').equals(localId).delete();
    await db.syncQueue.where('entityLocalId').equals(localId).filter(e => e.entityType === 'quote').delete();
    await db.quotes.delete(localId);
    setLocalDeleteConfirm(null);
    loadLocalQuotes();
    const pendingCount = await db.syncQueue.count();
    useQuoteStore.setState(s => ({ ...s, pendingSync: pendingCount }));
  };

  const formatDate = (dateString: string) => format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(amount);

  const tabQuotes = quotes.filter((quote) =>
    activeTab === 'closed' ? CLOSED_STATUSES.includes(quote.status) : !CLOSED_STATUSES.includes(quote.status)
  );

  const searchBase = serverResults
    ? serverResults.filter((quote) => activeTab === 'closed' ? CLOSED_STATUSES.includes(quote.status) : !CLOSED_STATUSES.includes(quote.status))
    : tabQuotes;
  const filteredQuotes = searchBase.filter((quote) => {
    const searchLower = search.toLowerCase();
    return (
      quote.quoteNumber.toString().includes(searchLower) ||
      (quote.customer?.name ?? '').toLowerCase().includes(searchLower) ||
      (quote.user?.username ?? '').toLowerCase().includes(searchLower) ||
      formatDate(quote.createdAt).toLowerCase().includes(searchLower)
    );
  });

  const activeCount = quotes.filter(q => !CLOSED_STATUSES.includes(q.status)).length;
  const closedCount = quotes.filter(q => CLOSED_STATUSES.includes(q.status)).length;

  const getPriceBreakdown = (quote: Quote) => {
    if (!quote.items || quote.items.length === 0) return { subtotal: quote.totalAmount, tax: 0, total: quote.totalAmount };
    let subtotal = 0, totalTax = 0;
    quote.items.forEach((item: QuoteItem) => {
      const base = Number(item.unitPrice) * Number(item.quantity);
      subtotal += base;
      totalTax += base * (Number(item.taxRate) / 100);
    });
    return { subtotal, tax: totalTax, total: subtotal + totalTax };
  };

  const getSyncStatusIcon = (item: LocalQuoteMeta) => {
    if (item.errorMsg) return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (item.attempts > 0) return <AlertCircle className="w-4 h-4 text-amber-900" />;
    return <Clock className="w-4 h-4 text-primary" />;
  };

  const getSyncStatusLabel = (item: LocalQuoteMeta) => {
    if (item.errorMsg) return <span className="text-xs text-red-600 font-medium">Error al sincronizar</span>;
    if (item.attempts > 0) return <span className="text-xs text-amber-900 font-medium">{item.attempts} intento{item.attempts > 1 ? 's' : ''} fallido{item.attempts > 1 ? 's' : ''}</span>;
    return <span className="text-xs text-primary font-medium">Pendiente de enviar</span>;
  };

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Cotizaciones
            </h1>
            <p className="text-sm text-gray-600">
              Propuestas comerciales — no afectan el inventario hasta convertirse en orden.
            </p>
          </div>

          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2">
              <Button variant="outline" icon={RotateCw} onClick={handleRefresh} size="sm" className="text-xs sm:text-sm">
                Actualizar
              </Button>
              {navigator.onLine && (pendingSync > 0 || localQuotes.length > 0 || quotes.some(q => (q as any)._isLocal)) && (
                <Button
                  variant="outline"
                  icon={syncing ? undefined : RefreshCw}
                  onClick={handleManualSync}
                  disabled={syncing}
                  size="sm"
                  className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                >
                  {syncing ? <LoadingSpinner size="sm" /> : 'Sincronizar'}
                </Button>
              )}
            </div>
            {(user?.role === "admin" || user?.role === "seller") && (
              <Button variant="primary" icon={Plus} onClick={() => navigate("/quotes/new")} size="sm" className="font-medium">
                Nueva cotización
              </Button>
            )}
          </div>
        </div>

        {error && <ErrorMessage message={error} onDismiss={clearError} onRetry={handleRefresh} className="mb-4 sm:mb-6" />}

        {/* Tabs */}
        <SegmentedTabs<TabType>
          ariaLabel="Tipo de cotizaciones"
          className="mb-4"
          value={activeTab}
          onChange={(k) => { setActiveTab(k); if (k === 'active' || k === 'closed') setSearch(''); }}
          tabs={[
            { key: 'active', label: 'Activas', count: activeCount },
            { key: 'closed', label: 'Cerradas', count: closedCount },
            { key: 'local', label: 'Sin enviar', icon: CloudOff, count: pendingSync, attention: true },
            ...(user?.role === 'admin'
              ? [{ key: 'trash' as const, label: 'Papelera', icon: Trash2, count: activeTab === 'trash' ? trashList.length : undefined }]
              : []),
          ]}
        />

        {/* ── TRASH TAB ────────────────────────────────────────────────── */}
        {activeTab === 'trash' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Trash2 className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">Cotizaciones eliminadas</span>
              <span className="text-xs text-gray-500">— Solo admins pueden restaurar o eliminar definitivamente</span>
            </div>

            {trashLoading ? (
              <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
            ) : trashList.length === 0 ? (
              <div className="text-center py-16">
                <Trash2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">La papelera está vacía</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trashList.map((quote) => (
                  <div key={quote.id} className="bg-white rounded-xl border border-red-100 shadow-sm p-4 opacity-75">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700 line-through">#{quote.quoteNumber}</p>
                        <p className="text-xs text-gray-500 truncate">{quote.customer?.name ?? `Cliente #${quote.customerId}`}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(quote.totalAmount)}</p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleRestore(quote.id)}
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Restaurar"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setHardDeleteConfirm(quote.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar definitivamente"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-red-400 mt-1">Eliminada: {formatDate((quote as any).deletedAt ?? quote.updatedAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LOCAL TAB ────────────────────────────────────────────────── */}
        {activeTab === 'local' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-medium mb-1">Cotizaciones guardadas solo en este dispositivo</p>
              <p className="text-amber-700">
                Estas cotizaciones no han llegado al servidor todavía. Puedes sincronizarlas si tienes conexión,
                o eliminarlas permanentemente de este dispositivo.
              </p>
            </div>

            {navigator.onLine && localQuotes.length > 0 && (
              <Button
                variant="primary"
                icon={syncing ? undefined : CheckCircle2}
                onClick={handleManualSync}
                disabled={syncing}
                className="w-full sm:w-auto"
              >
                {syncing ? <><LoadingSpinner size="sm" /><span className="ml-2">Sincronizando...</span></> : `Sincronizar ${localQuotes.length} cotización${localQuotes.length !== 1 ? 'es' : ''}`}
              </Button>
            )}

            {loadingLocal ? (
              <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : localQuotes.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Todo sincronizado</h3>
                <p className="text-gray-500 text-sm">No hay cotizaciones pendientes en este dispositivo</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {localQuotes.map(({ quote, customerName, attempts, errorMsg, lastAttemptAt }) => (
                  <div key={quote.id} className={`bg-white rounded-xl border p-4 shadow-sm ${errorMsg ? 'border-red-200' : 'border-amber-200'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-semibold text-gray-900">#{quote.quoteNumber}</span>
                          {quote._syncStatus === SyncStatus.CONFLICT ? (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                              <AlertCircle className="w-3 h-3" />
                              Conflicto
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                              <WifiOff className="w-3 h-3" />
                              Local
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{quote.createdAt ? formatDate(quote.createdAt) : '—'}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getSyncStatusIcon({ quote, customerName, attempts, errorMsg, lastAttemptAt })}
                        {getSyncStatusLabel({ quote, customerName, attempts, errorMsg, lastAttemptAt })}
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        <span className="truncate">{customerName ?? `Cliente #${quote.customerId}`}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Total</span>
                        <span className="text-base font-bold text-gray-900">{formatCurrency(quote.totalAmount)}</span>
                      </div>
                    </div>

                    {errorMsg && (
                      <div className="mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <p className="text-xs text-red-700 font-medium">Error:</p>
                        <p className="text-xs text-red-600 break-words">{errorMsg}</p>
                        {lastAttemptAt && (
                          <p className="text-xs text-red-400 mt-0.5">Último intento: {formatDate(new Date(lastAttemptAt).toISOString())}</p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      {navigator.onLine && (
                        <Button
                          variant="outline"
                          icon={RefreshCw}
                          onClick={() =>
                            quote._syncStatus === SyncStatus.CONFLICT
                              ? handleRetryConflict(quote.id!)
                              : handleManualSync()
                          }
                          disabled={syncing}
                          size="sm"
                          className={`flex-1 text-xs ${quote._syncStatus === SyncStatus.CONFLICT ? 'border-red-300 text-red-700 hover:bg-red-50' : ''}`}
                        >
                          {quote._syncStatus === SyncStatus.CONFLICT ? 'Forzar reintento' : 'Reintentar'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        icon={Trash2}
                        onClick={() => setLocalDeleteConfirm(quote.id!)}
                        size="sm"
                        className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SERVER TABS ──────────────────────────────────────────────── */}
        {activeTab !== 'local' && (
          <div className="space-y-4 sm:space-y-6">
            {loading ? (
              <div className="flex justify-center items-center py-12 sm:py-16"><LoadingSpinner size="lg" /></div>
            ) : (
              <>
                {tabQuotes.length > 0 && (
                  <div className="flex flex-wrap gap-3 justify-between items-center px-1">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                      {activeTab === 'closed' ? 'Cerradas' : 'Activas'}
                      <span className="text-gray-500 font-normal ml-2 text-sm sm:text-base">({tabQuotes.length})</span>
                    </h2>
                    <div className="flex flex-wrap sm:flex-nowrap items-center w-full sm:w-auto gap-2">
                      <input
                        type="search"
                        aria-label="Buscar cotizaciones"
                        placeholder="Buscar por cliente, usuario, cotización o fecha"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full sm:w-80 min-w-0 flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}

                {filteredQuotes.length > 0 ? (
                  <>
                  {/* Desktop: tabla densa (antes 3 columnas de tarjetas) */}
                  <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs font-medium text-gray-600">
                        <tr>
                          <th scope="col" className="px-4 py-2.5">Cotización</th>
                          <th scope="col" className="px-4 py-2.5">Cliente</th>
                          <th scope="col" className="px-4 py-2.5">Fecha</th>
                          <th scope="col" className="px-4 py-2.5">Válida hasta</th>
                          <th scope="col" className="px-4 py-2.5">Estado</th>
                          <th scope="col" className="px-4 py-2.5 text-right">Total</th>
                          <th scope="col" className="px-2 py-2.5"><span className="sr-only">Acciones</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredQuotes.map((quote) => {
                          const isLocal = (quote as { _isLocal?: boolean })._isLocal;
                          const canEdit = (user?.role === "admin" || user?.role === "seller") && quote.status !== 'converted';
                          const expired = !!quote.validUntil && new Date(quote.validUntil) < new Date() && !CLOSED_STATUSES.includes(quote.status);
                          return (
                            <tr
                              key={quote.id}
                              tabIndex={0}
                              onClick={() => navigate(`/quotes/${quote.id}`)}
                              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/quotes/${quote.id}`); }}
                              className="cursor-pointer hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                            >
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span className="font-mono text-xs font-semibold text-gray-900">#{quote.quoteNumber}</span>
                                {isLocal && (
                                  <span className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-900">
                                    <WifiOff className="w-3 h-3" aria-hidden="true" /> Sin enviar
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-gray-900">{quote.customer?.name || `ID: ${quote.customerId}`}</p>
                                <p className="text-xs text-gray-600">{quote.user?.username || ''}</p>
                              </td>
                              <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{formatDate(quote.createdAt)}</td>
                              <td className={`px-4 py-2.5 whitespace-nowrap ${expired ? 'font-semibold text-red-700' : 'text-gray-700'}`}>
                                {quote.validUntil ? format(new Date(quote.validUntil), 'd MMM', { locale: es }) : '—'}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[quote.status]}`}>{STATUS_LABEL[quote.status]}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap tabular-nums">
                                {formatCurrency(getPriceBreakdown(quote).total)}
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                                {canEdit && (
                                  <>
                                    <button type="button" onClick={() => navigate(`/quotes/${quote.id}/edit`)} disabled={isLocal}
                                      aria-label={`Editar cotización ${quote.quoteNumber}`} title={isLocal ? 'No disponible hasta sincronizar' : 'Editar'}
                                      className="inline-flex w-9 h-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40">
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => { setQuoteToDelete(quote.id); setShowDeleteModal(true); }}
                                      aria-label={`Eliminar cotización ${quote.quoteNumber}`} title="Eliminar"
                                      className="inline-flex w-9 h-9 items-center justify-center rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-700">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: filas compactas */}
                  <ul className="md:hidden bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {filteredQuotes.map((quote) => {
                      const isLocal = (quote as { _isLocal?: boolean })._isLocal;
                      return (
                        <li key={quote.id}>
                          <button type="button" onClick={() => navigate(`/quotes/${quote.id}`)}
                            className="w-full min-h-[64px] flex items-center gap-3 px-4 py-2.5 text-left active:bg-gray-50">
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-gray-900 truncate">{quote.customer?.name || `ID: ${quote.customerId}`}</span>
                              <span className="block text-xs text-gray-600">
                                <span className="font-mono">#{quote.quoteNumber}</span> · {formatDate(quote.createdAt)}{isLocal ? ' · sin enviar' : ''}
                              </span>
                            </span>
                            <span className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(getPriceBreakdown(quote).total)}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[quote.status]}`}>{STATUS_LABEL[quote.status]}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  </>
                ) : (
                  <div className="text-center py-12 sm:py-16 px-4">
                    {activeTab === 'closed'
                      ? <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                      : <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />}
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                      {activeTab === 'closed' ? 'No hay cotizaciones cerradas' : 'No hay cotizaciones activas'}
                    </h3>
                    {activeTab === 'active' && (user?.role === "admin" || user?.role === "seller") && (
                      <>
                        <p className="text-sm sm:text-base text-gray-500 mb-6 max-w-sm mx-auto">Comienza creando tu primera cotización</p>
                        <Button variant="primary" icon={Plus} onClick={() => navigate("/quotes/new")} className="w-full sm:w-auto max-w-xs mx-auto">
                          Crear cotización
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Cargar más — acumula sobre las ya mostradas */}
            {activeTab !== 'local' && activeTab !== 'trash' && !loading && quotes.length < pagination.total && (
              <div className="flex justify-center mt-6">
                <Button variant="outline" size="sm" onClick={loadMoreQuotes}>
                  Cargar más cotizaciones ({quotes.length} de {pagination.total})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: hard delete cotización de papelera */}
      {hardDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setHardDeleteConfirm(null)}>
          <div className="animate-slide-up w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="p-6 pb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <div><h3 className="font-semibold text-gray-900">Eliminar definitivamente</h3><p className="text-sm text-gray-500">Esta acción es irreversible. La cotización se borrará para siempre.</p></div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setHardDeleteConfirm(null)} className="flex-1">Cancelar</Button>
                <Button variant="danger" onClick={() => handleHardDelete(hardDeleteConfirm)} className="flex-1">Eliminar para siempre</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: eliminar cotización del servidor */}
      {showDeleteModal && quoteToDelete !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowDeleteModal(false)}>
          <div className="animate-slide-up w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="p-6 pb-8">
              <h2 className="text-base font-semibold text-gray-900 mb-2">¿Eliminar cotización?</h2>
              <p className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1">Cancelar</Button>
                <Button variant="danger" className="flex-1" onClick={async () => {
                  try {
                    await deleteQuote(quoteToDelete);
                    setShowDeleteModal(false);
                    setQuoteToDelete(null);
                    handleRefresh();
                  } catch (error: unknown) {
                    const msg = error instanceof Error ? error.message : 'Error al eliminar la cotización';
                    addNotification({ type: 'error', title: 'Error', message: msg });
                    setShowDeleteModal(false);
                  }
                }}>Eliminar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: eliminar cotización de local (Dexie) */}
      {localDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setLocalDeleteConfirm(null)}>
          <div className="animate-slide-up w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="p-6 pb-8">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Eliminar de este dispositivo</h3>
              <p className="text-sm text-gray-600 text-center mb-6">Esta cotización nunca llegó al servidor y será eliminada solo de este dispositivo.</p>
              <div className="flex gap-3">
                <button onClick={() => setLocalDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={() => handleDeleteLocal(localDeleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotes;
