import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, X, Edit, Trash2, Tag, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/products';
import { Category, CreateCategoryRequest } from '../types';
import { useUIStore } from '../store/uiStore';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Categories: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useUIStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; category?: Category } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);
  const [form, setForm] = useState<CreateCategoryRequest>({ name: '', description: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await productService.getCategories();
      setCategories(data);
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudieron cargar las categorías' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ name: '', description: '' });
    setModal({ mode: 'create' });
  };

  const openEdit = (c: Category) => {
    setForm({ name: c.name, description: c.description ?? '' });
    setModal({ mode: 'edit', category: c });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (modal?.mode === 'edit' && modal.category) {
        await productService.updateCategory(modal.category.id, form);
        addNotification({ type: 'success', title: 'Categoría actualizada', message: form.name });
      } else {
        await productService.createCategory(form);
        addNotification({ type: 'success', title: 'Categoría creada', message: form.name });
      }
      setModal(null);
      load();
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo guardar la categoría' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await productService.deleteCategory(confirmDelete.id);
      setConfirmDelete(null);
      addNotification({ type: 'success', title: 'Categoría eliminada', message: confirmDelete.name });
      load();
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar la categoría' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 max-w-7xl mx-auto">
      {/* Header */}
      <div className="px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8">
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-sm text-gray-600">Organiza tus productos por categorías.</p>
        </div>
      </div>
      <div className="px-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between mb-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 z-10" />
          <Input
            type="text"
            placeholder="Buscar categorías..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <p className="text-sm text-gray-500">{loading ? '...' : `${filtered.length} categorías`}</p>
          <Button variant="primary" icon={Plus} onClick={openCreate} size="sm" className="px-3">
            Nueva
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
              <Tag className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay categorías</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery ? 'Sin resultados para esa búsqueda' : 'Aún no hay categorías registradas'}
            </p>
            {!searchQuery && (
              <Button variant="primary" icon={Plus} onClick={openCreate}>Crear categoría</Button>
            )}
          </div>
        ) : (
          <>
          {/* Tabla densa con acciones visibles (antes tarjetas con menú ⋮ escondido) */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-2.5 ">Categoría</th>
                  <th scope="col" className="px-4 py-2.5 ">Descripción</th>
                  <th scope="col" className="px-2 py-2.5"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700 "><span className="font-medium text-gray-900">{c.name}</span></td>
                    <td className="px-4 py-2.5 text-gray-700 ">{c.description || '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-right">
                      <button type="button" onClick={() => openEdit(c)} aria-label={`Editar categoría ${c.name}`} title="Editar"
                        className="inline-flex w-9 h-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(c)} aria-label={`Eliminar categoría ${c.name}`} title="Eliminar"
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
            {filtered.map(c => (
              <li key={c.id} className="flex items-center gap-2 px-4 py-2.5 min-h-[64px]">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{c.name}</span>
                  <span className="block text-xs text-gray-600 truncate">{[c.description].filter(Boolean).join(' · ')}</span>
                </span>
                <button type="button" onClick={() => openEdit(c)} aria-label={`Editar categoría ${c.name}`}
                  className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100">
                  <Edit className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setConfirmDelete(c)} aria-label={`Eliminar categoría ${c.name}`}
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
                {modal.mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre de la categoría" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <Input value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción opcional" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { if (!saving) setModal(null); }} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" disabled={saving}>Cancelar</button>
                <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
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
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Eliminar categoría</h3>
              <p className="text-sm text-gray-600 text-center mb-6">
                ¿Eliminar <span className="font-semibold text-gray-900">{confirmDelete.name}</span>? Los productos quedarán sin categoría.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50" disabled={saving}>Cancelar</button>
                <button onClick={handleDelete} disabled={saving} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">{saving ? 'Eliminando...' : 'Eliminar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
