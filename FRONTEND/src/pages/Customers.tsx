import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, User, Phone, MapPin, Hash, Tag, RefreshCw, RotateCcw, AlertTriangle } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { Customer } from '../types/customer';
import { customerService } from '../services/customers';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import CustomerModal from '../components/ui/CustomerModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const Customers: React.FC = () => {
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const { customers, loading, error, pagination, getCustomers, searchCustomers, deleteCustomer, clearError } =
    useCustomerStore();

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [trashList, setTrashList] = useState<Customer[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<number | null>(null);

  useEffect(() => { getCustomers(1, 50); }, [getCustomers]);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    try {
      const deleted = await customerService.getDeletedCustomers();
      setTrashList(deleted);
    } finally {
      setTrashLoading(false);
    }
  }, []);

  useEffect(() => { if (showTrash) loadTrash(); }, [showTrash, loadTrash]);

  const handleRestore = async (id: number) => {
    try {
      await customerService.restoreCustomer(id);
      addNotification({ type: 'success', title: 'Cliente restaurado', message: 'El cliente volvió a la lista activa.' });
      loadTrash();
      getCustomers(1, 50);
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo restaurar el cliente.' });
    }
  };

  const handleHardDelete = async (id: number) => {
    try {
      await customerService.hardDeleteCustomer(id);
      addNotification({ type: 'success', title: 'Eliminado definitivamente', message: 'El cliente fue eliminado de forma permanente.' });
      setHardDeleteConfirm(null);
      loadTrash();
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar el cliente.' });
    }
  };

  const handleSearch = useCallback(async (q: string) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const results = await searchCustomers(q.trim());
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }, [searchCustomers]);

  const displayList = searchResults ?? customers;

  const handleDelete = async (id: number) => {
    try {
      await deleteCustomer(id);
      addNotification({ type: 'success', title: 'Cliente eliminado', message: 'El cliente fue eliminado correctamente.' });
      setDeleteConfirm(null);
      setSearchResults(null);
      setSearch('');
    } catch {
      // error handled by store
    }
  };

  const handleCustomerSaved = () => {
    setShowModal(false);
    setEditCustomer(undefined);
    getCustomers(1, 50);
    if (search) handleSearch(search);
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d), 'dd/MM/yyyy', { locale: es }); } catch { return d; }
  };

  const canManage = user?.role === 'admin' || user?.role === 'seller';
  const canDelete = user?.role === 'admin';

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1">Clientes</h1>
            <p className="text-sm text-gray-600">Gestiona la base de clientes del sistema.</p>
          </div>

          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2">
              <Button variant="outline" icon={RefreshCw} onClick={() => showTrash ? loadTrash() : getCustomers(1, 50)} size="sm" className="text-xs sm:text-sm">
                Actualizar
              </Button>
              {canDelete && (
                <button
                  onClick={() => { setShowTrash(!showTrash); setSearch(''); setSearchResults(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    showTrash
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Papelera {trashList.length > 0 && showTrash ? `(${trashList.length})` : ''}
                </button>
              )}
            </div>
            {canManage && !showTrash && (
              <Button variant="primary" icon={Plus} onClick={() => { setEditCustomer(undefined); setShowModal(true); }} size="sm">
                Nuevo cliente
              </Button>
            )}
          </div>
        </div>

        {error && <ErrorMessage message={error} onDismiss={clearError} className="mb-4" />}

        {/* ── PAPELERA ─────────────────────────────────────────────────── */}
        {showTrash ? (
          <>
            <div className="flex items-center gap-2 mb-4 px-1">
              <Trash2 className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">Clientes eliminados</span>
              <span className="text-xs text-gray-400">— Solo admins pueden restaurar o eliminar definitivamente</span>
            </div>

            {trashLoading ? (
              <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
            ) : trashList.length === 0 ? (
              <div className="text-center py-16">
                <Trash2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">La papelera está vacía</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trashList.map((customer) => (
                  <div key={customer.id} className="bg-white rounded-xl border border-red-100 shadow-sm p-4 opacity-75">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-700 truncate line-through">{customer.name}</h3>
                        {customer.nit && <p className="text-xs text-gray-400">NIT: {customer.nit}</p>}
                        {customer.contact && <p className="text-xs text-gray-400">{customer.contact}</p>}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleRestore(customer.id)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Restaurar"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setHardDeleteConfirm(customer.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar definitivamente"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-red-400 mt-1">Eliminado: {formatDate((customer as any).deletedAt ?? customer.updatedAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
        <>
        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por código, nombre, NIT o contacto..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {searching && <LoadingSpinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}
        </div>

        {/* Stats */}
        <div className="text-xs text-gray-500 mb-3 px-1">
          {search
            ? `${displayList.length} resultado${displayList.length !== 1 ? 's' : ''} para "${search}"`
            : `${pagination.total || customers.length} cliente${(pagination.total || customers.length) !== 1 ? 's' : ''} en total`}
        </div>

        {/* List */}
        {loading && !customers.length ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-16">
            <User className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-700 mb-1">
              {search ? 'Sin resultados' : 'No hay clientes'}
            </h3>
            <p className="text-gray-500 text-sm">
              {search ? `No se encontraron clientes con "${search}"` : 'Agrega el primer cliente con el botón de arriba'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayList.map((customer) => (
              <div key={customer.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {customer.code && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-mono font-medium rounded">
                          <Tag className="w-3 h-3" />
                          {customer.code}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{customer.name}</h3>
                    {customer.nit && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Hash className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-500">{customer.nit}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    {canManage && (
                      <button
                        onClick={() => { setEditCustomer(customer); setShowModal(true); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setDeleteConfirm(customer.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1">
                  {customer.contact && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{customer.contact}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{customer.address}</span>
                    </div>
                  )}
                  {customer.note && (
                    <p className="text-xs text-gray-400 italic truncate pt-0.5">{customer.note}</p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Creado: {formatDate(customer.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!search && pagination.totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button variant="outline" size="sm" onClick={() => getCustomers(pagination.page - 1, 50)} disabled={pagination.page <= 1 || loading}>Anterior</Button>
            <span className="text-sm text-gray-600">{pagination.page} / {pagination.totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => getCustomers(pagination.page + 1, 50)} disabled={pagination.page >= pagination.totalPages || loading}>Siguiente</Button>
          </div>
        )}
        </> /* end of non-trash view */
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <CustomerModal
          onClose={() => { setShowModal(false); setEditCustomer(undefined); }}
          onCustomerCreated={handleCustomerSaved}
          onCustomerUpdated={handleCustomerSaved}
          editCustomer={editCustomer}
        />
      )}

      {/* Hard Delete Confirm */}
      {hardDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Eliminar definitivamente</h3>
                <p className="text-sm text-gray-500">Esta acción es irreversible. El cliente se borrará para siempre.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setHardDeleteConfirm(null)} className="flex-1">Cancelar</Button>
              <Button variant="danger" onClick={() => handleHardDelete(hardDeleteConfirm)} className="flex-1">Eliminar para siempre</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Eliminar cliente</h3>
                <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">Cancelar</Button>
              <Button variant="danger" onClick={() => handleDelete(deleteConfirm)} className="flex-1">Eliminar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
