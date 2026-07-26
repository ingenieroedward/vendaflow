import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Tag, Calendar, Edit, TrendingUp, Trash2 } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { useProductStore } from '../store/productStore';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import PriceTable from '../components/features/PriceTable';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorMessage from '../components/ui/ErrorMessage';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { formatDateShort, formatCurrency } from '../utils/helpers';
import { productService } from '../services/products';
import { Supplier, CreateSupplierRequest, CreatePriceRequest } from '../types/product';

interface SupplierFormData {
  name: string;
  contact: string;
  location: string;
}

interface PriceFormData {
  supplierId?: number;
  price: number;
}

interface PriceErrors {
  supplierId?: string;
  price?: string;
}

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentProduct: product,
    prices,
    loading,
    pricesLoading,
    error,
    getProductById,
    getPricesByProduct,
    deleteProduct,
    clearError,
    clearCurrentProduct
  } = useProductStore();
  const { addNotification } = useUIStore();
  const { user } = useAuthStore();

  // Modal state
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Form data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierForm, setSupplierForm] = useState<SupplierFormData>({
    name: '',
    contact: '',
    location: '',
  });
  const [supplierErrors, setSupplierErrors] = useState<Partial<SupplierFormData>>({});
  
  const [priceForm, setPriceForm] = useState<PriceFormData>({
    price: 0,
  });
  const [priceErrors, setPriceErrors] = useState<PriceErrors>({});

  useEffect(() => {
    if (id) {
      const productId = parseInt(id, 10);
      getProductById(productId);
      getPricesByProduct(productId);
      loadSuppliers();
    }

    return () => {
      clearCurrentProduct();
    };
  }, [id]);

  const loadSuppliers = async () => {
    try {
      if (!navigator.onLine) {
        // Cargar desde IndexedDB sin notificación de error
        const { db } = await import('../database/LocalDatabase');
        const local = await db.suppliers.filter(s => !s.deletedAt).toArray();
        setSuppliers(local.map(s => ({
          id: s.serverId ?? s.id!,
          name: s.name,
          contact: s.contact,
          location: s.location,
          createdAt: s.createdAt ?? '',
          updatedAt: s.updatedAt ?? '',
        })));
        return;
      }
      const response = await productService.getSuppliers(1, 100);
      setSuppliers(response.data);
    } catch {
      // Silencioso — no mostrar error por no poder cargar proveedores
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleEdit = () => {
    navigate(`/products/${id}/edit`);
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteProduct(parseInt(id, 10));
      addNotification({ type: 'success', title: 'Producto eliminado', message: 'El producto y sus precios fueron eliminados.' });
      navigate('/');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al eliminar el producto';
      addNotification({ type: 'error', title: 'Error', message: msg });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAddPrice = () => {
    setShowPriceModal(true);
    setPriceForm({ price: 0 });
    setPriceErrors({});
  };

  const validateSupplierForm = (): boolean => {
    const newErrors: Partial<SupplierFormData> = {};

    if (!supplierForm.name.trim()) {
      newErrors.name = 'El nombre del proveedor es requerido';
    }
    if (!supplierForm.contact.trim()) {
      newErrors.contact = 'El contacto es requerido';
    }
    if (!supplierForm.location.trim()) {
      newErrors.location = 'La ubicación es requerida';
    }

    setSupplierErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePriceForm = (): boolean => {
    const newErrors: PriceErrors = {};

    if (!priceForm.supplierId) {
      newErrors.supplierId = 'Debe seleccionar un proveedor';
    }
    if (priceForm.price <= 0) {
      newErrors.price = 'El precio debe ser mayor a 0';
    }

    setPriceErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSupplierInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSupplierForm(prev => ({ ...prev, [name]: value }));
    
    if (supplierErrors[name as keyof SupplierFormData]) {
      setSupplierErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handlePriceInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'price') {
      const numValue = value === '' ? 0 : parseFloat(value);
      setPriceForm(prev => ({ ...prev, [name]: isNaN(numValue) ? 0 : numValue }));
    } else {
      setPriceForm(prev => ({ ...prev, [name]: value ? parseInt(value) : undefined }));
    }
    
    if (priceErrors[name as keyof PriceFormData]) {
      setPriceErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleCreateSupplier = async () => {
    if (!validateSupplierForm()) return;

    try {
      const newSupplier = await productService.createSupplier(supplierForm as CreateSupplierRequest);
      setSuppliers(prev => [...prev, newSupplier]);
      setShowSupplierForm(false);
      setSupplierForm({ name: '', contact: '', location: '' });
      setPriceForm(prev => ({ ...prev, supplierId: newSupplier.id }));
      addNotification({
        type: 'success',
        title: 'Proveedor creado',
        message: 'El proveedor se ha creado correctamente',
      });
    } catch (error: unknown) {
      let errorMessage = 'Error al crear el proveedor';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      addNotification({
        type: 'error',
        title: 'Error',
        message: errorMessage,
      });
    }
  };

  const handleCreatePrice = async () => {
    if (!validatePriceForm()) return;

    try {
      const priceData: CreatePriceRequest = {
        productId: parseInt(id!),
        supplierId: priceForm.supplierId!,
        price: priceForm.price,
      };
      
      await productService.createPrice(priceData);
      
      // Refresh prices
      await getPricesByProduct(parseInt(id!));
      
      setShowPriceModal(false);
      setPriceForm({ price: 0 });
      setPriceErrors({});
      
      addNotification({
        type: 'success',
        title: 'Precio creado',
        message: 'El precio se ha agregado correctamente',
      });
    } catch (error: unknown) {
      let errorMessage = 'Error al crear el precio';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      addNotification({
        type: 'error',
        title: 'Error',
        message: errorMessage,
      });
    }
  };

  const handleCloseModal = () => {
    setShowPriceModal(false);
    setShowSupplierForm(false);
    setPriceForm({ price: 0 });
    setPriceErrors({});
    setSupplierForm({ name: '', contact: '', location: '' });
    setSupplierErrors({});
  };

  if (loading) {
    return (
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorMessage
            message={error}
            onDismiss={clearError}
            onRetry={() => id && getProductById(parseInt(id, 10))}
          />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Producto no encontrado
            </h3>
            <p className="text-gray-500 mb-6">
              El producto que buscas no existe o ha sido eliminado
            </p>
            <Button variant="primary" onClick={handleBack}>
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const lowestPrice = prices.length > 0 ? Math.min(...prices.map(p => p.price)) : 0;
  const highestPrice = prices.length > 0 ? Math.max(...prices.map(p => p.price)) : 0;
  const averagePrice = prices.length > 0 ? prices.reduce((sum, p) => sum + Number(p.price), 0) / prices.length : 0;

  return (
    <div className="bg-gray-50">
      <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto">
        {/* Mobile Header - Compact */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <Breadcrumbs
            items={[{ label: 'Productos', to: '/' }, { label: product?.name ?? 'Detalle' }]}
            className="mb-2"
          />
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={handleBack}
            className="mb-3 sm:mb-4 -ml-2"
            size="sm"
          >
            Volver
          </Button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex md:items-center  justify-between">
              <div className="flex items-start space-x-3 sm:space-x-4 mb-4 lg:mb-0">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
                    {product.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs sm:text-sm text-gray-500">Precio de venta:</span>
                    <span className="text-base sm:text-lg font-semibold text-blue-600">
                      {typeof product.salePrice === 'number' && !isNaN(product.salePrice)
                        ? formatCurrency(product.salePrice)
                        : '-'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                    <div className="flex items-center">
                      <span className="font-medium text-blue-600">{product.code}</span>
                    </div>
                    <div className="flex items-center">
                      <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span>{product.unit}</span>
                    </div>
                    {product.category && (
                      <div className="flex items-center">
                        <span>•</span>
                        <span className="ml-1">{product.category.name}</span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span>Actualizado {formatDateShort(product.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex  flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <Button
                  variant="outline"
                  icon={Edit}
                  onClick={handleEdit}
                  size="sm"
                  className="w-full sm:w-auto hidden md:flex"
                >
                  Editar
                </Button>
                <Button
                  variant="outline"
                  icon={Edit}
                  onClick={handleEdit}
                  size="sm"
                  className="sm:w-auto md:hidden"
                >
                  <span className="sr-only">Editar</span>
                </Button>
                {user?.role === 'admin' && (
                  <Button
                    variant="danger"
                    icon={Trash2}
                    onClick={() => setShowDeleteConfirm(true)}
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <span className="hidden md:inline">Eliminar</span>
                  </Button>
                )}
                <Button
                  variant="primary"
                  icon={TrendingUp}
                  onClick={handleAddPrice}
                  size="sm"
                  className="w-full sm:w-auto hidden md:flex"
                >
                  Agregar precio
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Price Stats - Mobile Optimized */}
        {pricesLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-3 sm:p-6 shadow-sm border border-gray-200 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-7 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : prices.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-xl p-3 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Proveedores</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{prices.length}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Menor precio</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-600">{formatCurrency(lowestPrice)}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Mayor precio</p>
                  <p className="text-lg sm:text-2xl font-bold text-red-600">{formatCurrency(highestPrice)}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 transform rotate-180" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Precio promedio</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-600">{formatCurrency(averagePrice)}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-xs sm:text-sm">Ø</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Prices Table - Mobile Optimized */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between gap-3 sm:gap-0">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Precios
            </h2>
            <Button
              variant="primary"
              icon={TrendingUp}
              onClick={handleAddPrice}
              size="sm"
              className="w-auto max-w-40"
            >
              Agregar precio
            </Button>
          </div>

          {pricesLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center px-4 py-4 border-b border-gray-100 last:border-0 gap-4">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-1/4 ml-auto" />
                  <div className="h-4 bg-gray-200 rounded w-1/5" />
                </div>
              ))}
            </div>
          ) : (
            <PriceTable prices={prices} />
          )}
        </div>

        {/* Product Info - Mobile Optimized */}
        {product.category?.description && (
          <div className="mt-6 sm:mt-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
                Información de categoría
              </h3>
              <p className="text-sm sm:text-base text-gray-600">{product.category.description}</p>
            </div>
          </div>
        )}

        {/* Price Modal */}
        <Modal
          isOpen={showPriceModal}
          onClose={handleCloseModal}
          title="Agregar Nuevo Precio"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="supplier" className="block text-sm font-medium text-gray-700">
                Proveedor
              </label>
              <div className="flex space-x-2">
                <select
                  id="supplier"
                  name="supplierId"
                  value={priceForm.supplierId}
                  onChange={handlePriceInputChange}
                  className="flex-1 mt-1 block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">Seleccionar Proveedor</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSupplierForm(true)}
                  size="sm"
                  className="mt-1"
                >
                  Nuevo
                </Button>
              </div>
              {priceErrors.supplierId && (
                <p className="text-red-500 text-xs mt-1">{priceErrors.supplierId}</p>
              )}
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                Precio
              </label>
              <Input
                type="number"
                id="price"
                name="price"
                value={priceForm.price === 0 ? '' : String(priceForm.price)}
                onChange={handlePriceInputChange}
                placeholder="0.00"
                className="mt-1 block w-full"
              />
              {priceErrors.price && (
                <p className="text-red-500 text-xs mt-1">{priceErrors.price}</p>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleCreatePrice}>
                Guardar Precio
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Confirm Modal */}
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Eliminar producto"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que quieres eliminar <span className="font-semibold">{product?.name}</span>?
              Esta acción eliminará el producto y <span className="font-semibold">todos sus precios</span> de forma permanente. No se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button variant="danger" icon={Trash2} onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Supplier Form Modal */}
        <Modal
          isOpen={showSupplierForm}
          onClose={() => setShowSupplierForm(false)}
          title="Nuevo Proveedor"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="supplierName" className="block text-sm font-medium text-gray-700">
                Nombre del Proveedor
              </label>
              <Input
                type="text"
                id="supplierName"
                name="name"
                value={supplierForm.name}
                onChange={handleSupplierInputChange}
                placeholder="Nombre del Proveedor"
                className="mt-1 block w-full"
              />
              {supplierErrors.name && (
                <p className="text-red-500 text-xs mt-1">{supplierErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="supplierContact" className="block text-sm font-medium text-gray-700">
                Contacto
              </label>
              <Input
                type="text"
                id="supplierContact"
                name="contact"
                value={supplierForm.contact}
                onChange={handleSupplierInputChange}
                placeholder="Teléfono o Email"
                className="mt-1 block w-full"
              />
              {supplierErrors.contact && (
                <p className="text-red-500 text-xs mt-1">{supplierErrors.contact}</p>
              )}
            </div>

            <div>
              <label htmlFor="supplierLocation" className="block text-sm font-medium text-gray-700">
                Ubicación
              </label>
              <Input
                type="text"
                id="supplierLocation"
                name="location"
                value={supplierForm.location}
                onChange={handleSupplierInputChange}
                placeholder="Dirección o Ciudad"
                className="mt-1 block w-full"
              />
              {supplierErrors.location && (
                <p className="text-red-500 text-xs mt-1">{supplierErrors.location}</p>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowSupplierForm(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleCreateSupplier}>
                Crear Proveedor
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ProductDetail;