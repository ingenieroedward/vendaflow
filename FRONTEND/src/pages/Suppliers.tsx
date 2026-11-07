import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, X, Edit, Trash2, Truck, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/products';
import { Supplier, CreateSupplierRequest } from '../types';
import { useUIStore } from '../store/uiStore';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Suppliers: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useUIStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; supplier?: Supplier } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);
  const [form, setForm] = useState<CreateSupplierRequest>({ name: '', contact: '', location: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await productService.getSuppliers(1, 500);
      setSuppliers(res.data);
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudieron cargar los proveedores' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ name: '', contact: '', location: '' });
    setModal({ mode: 'create' });
  };

  const openEdit = (s: Supplier) => {
    setForm({ name: s.name, contact: s.contact, location: s.location });
    setModal({ mode: 'edit', supplier: s });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (modal?.mode === 'edit' && modal.supplier) {
        await productService.updateSupplier(modal.supplier.id, form);
        addNotification({ type: 'success', title: 'Proveedor actualizado', message: form.name });
      } else {
        await productService.createSupplier(form);
        addNotification({ type: 'success', title: 'Proveedor creado', message: form.name });
      }
      setModal(null);
      load();
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo guardar el proveedor' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await productService.deleteSupplier(confirmDelete.id);
      setConfirmDelete(null);
      addNotification({ type: 'success', title: 'Proveedor eliminado', message: confirmDelete.name });
      load();
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar el proveedor' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 max-w-7xl mx-auto">
      {/* Header */}
      <div className="px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8">
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-sm text-gray-600">Gestiona tus proveedores y sus contactos.</p>
        </div>
      </div>
      <div className="px-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between mb-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 z-10" />
          <Input
            type="text"
            placeholder="Buscar proveedores..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <p className="text-sm text-gray-500">{loading ? '...' : `${filtered.length} proveedores`}</p>
          <Button variant="primary" icon={Plus} onClick={openCreate} size="sm" className="px-3">
            Nuevo
          </Button>
        </div>
      </div>


      {/* List */}
      <div className="px-3 sm:px-6 lg:px-8 py-2">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay proveedores</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery ? 'Sin resultados para esa búsqueda' : 'Aún no hay proveedores registrados'}
            </p>
            {!searchQuery && (
              <Button variant="primary" icon={Plus} onClick={openCreate}>Crear proveedor</Button>
            )}
          </div>
        ) : (
          <>
          {/* Tabla densa con acciones visibles (antes tarjetas con menú ⋮ escondido) */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-2.5 ">Proveedor</th>
                  <th scope="col" className="px-4 py-2.5 ">Contacto</th>
                  <th scope="col" className="px-4 py-2.5 ">Ubicación</th>
                  <th scope="col" className="px-2 py-2.5"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700 "><span className="font-medium text-gray-900">{s.name}</span></td>
                    <td className="px-4 py-2.5 text-gray-700 ">{s.contact || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700 ">{s.location || '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-right">
                      <button type="button" onClick={() => openEdit(s)} aria-label={`Editar proveedor ${s.name}`} title="Editar"
                        className="inline-flex w-9 h-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(s)} aria-label={`Eliminar proveedor ${s.name}`} title="Eliminar"
                        className="inline-flex w-9 h-9 items-center justify-center rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {filtered.map(s => (
              <li key={s.id} className="flex items-center gap-2 px-4 py-2.5 min-h-[64px]">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{s.name}</span>
                  <span className="block text-xs text-gray-600 truncate">{[s.contact, s.location].filter(Boolean).join(' · ')}</span>
                </span>
                <button type="button" onClick={() => openEdit(s)} aria-label={`Editar proveedor ${s.name}`}
                  className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100">
                  <Edit className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setConfirmDelete(s)} aria-label={`Eliminar proveedor ${s.name}`}
                  className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          </>
        )}
      </div>
      <div className="h-6" />

      {/* Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { if (!saving) setModal(null); }}>
          <div className="animate-slide-up w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="p-6 pb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-5">
                {modal.mode === 'create' ? 'Nuevo proveedor' : 'Editar proveedor'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nombre del proveedor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
                  <Input
                    value={form.contact}
                    onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                    placeholder="Teléfono o email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                  <Input
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Ciudad o dirección"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { if (!saving) setModal(null); }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { if (!saving) setConfirmDelete(null); }}>
          <div className="animate-slide-up w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="p-6 pb-8">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Eliminar proveedor</h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              ¿Eliminar <span className="font-semibold text-gray-900">{confirmDelete.name}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
