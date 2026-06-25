import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Save, Plus, DollarSign, Building, X, Warehouse } from 'lucide-react';
import { useProductStore } from '../store/productStore';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { productService } from '../services/products';
import { Supplier, CreateSupplierRequest, CreatePriceRequest, Product } from '../types/product';

interface ProductFormData {
  name: string;
  code: string;
  unit: string;
  categoryId?: number | null;
  salePrice: number;
  stock: number;
  minStock: number;
}

interface SupplierFormData {
  name: string;
  contact: string;
  location: string;
}

interface PriceEntry {
  id: string;
  price: number;
  supplierId?: number;
  supplierName?: string;
  isNew?: boolean;
  originalPriceId?: number;
}

type ProductFormErrors = {
  name?: string;
  code?: string;
  unit?: string;
  salePrice?: string;
};

const ProductEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loading } = useProductStore();
  const { addNotification } = useUIStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  
  const [product, setProduct] = useState<Product | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    code: '',
    unit: '',
    salePrice: 0,
    stock: 0,
    minStock: 0,
  });
  const [errors, setErrors] = useState<ProductFormErrors>({});
  
  const [supplierForm, setSupplierForm] = useState<SupplierFormData>({
    name: '',
    contact: '',
    location: '',
  });
  const [supplierErrors, setSupplierErrors] = useState<Partial<SupplierFormData>>({});
  
  const [priceEntries, setPriceEntries] = useState<PriceEntry[]>([]);
  const [priceErrors, setPriceErrors] = useState<Partial<Record<keyof PriceEntry, string>>>({});

  // Load product and prices on component mount
  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      
      try {
        const productData = await productService.getProductById(parseInt(id));
        setProduct(productData);
        setFormData({
          name: productData.name,
          code: productData.code,
          unit: productData.unit,
          categoryId: productData.categoryId,
          salePrice: productData.salePrice,
          stock: productData.stock ?? 0,
          minStock: productData.minStock ?? 0,
        });

        const pricesData = await productService.getPricesByProduct(parseInt(id));
        
        // Convert existing prices to price entries
        const entries: PriceEntry[] = pricesData.map(price => ({
          id: `existing-${price.id}`,
          price: price.price,
          supplierId: price.supplierId,
          supplierName: price.supplier?.name,
          originalPriceId: price.id,
        }));
        setPriceEntries(entries);

        // Load suppliers
        const suppliersResponse = await productService.getSuppliers(1, 100);
        setSuppliers(suppliersResponse.data);
      } catch (error: unknown) {
        let errorMessage = 'Error al cargar el producto';
        
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
    
    loadData();
  }, [id]);

  const validateForm = (): boolean => {
    const newErrors: ProductFormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre del producto es requerido';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'El código del producto es requerido';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'La unidad es requerida';
    }

    if (
      formData.salePrice === undefined ||
      formData.salePrice === null ||
      isNaN(Number(formData.salePrice))
    ) {
      newErrors.salePrice = 'El precio de venta es requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePriceEntries = (): boolean => {
    if (priceEntries.length === 0) return true;
    
    setPriceErrors({});
    
    for (const entry of priceEntries) {
      if (entry.price <= 0) {
        setPriceErrors(prev => ({ ...prev, price: 'El precio debe ser mayor a 0' }));
        return false;
      }
      if (!entry.supplierId) {
        setPriceErrors(prev => ({ ...prev, supplierId: 'Debe seleccionar un proveedor' }));
        return false;
      }
    }
    return true;
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFields = ['salePrice', 'stock', 'minStock'];
    setFormData(prev => ({
      ...prev,
      [name]: numericFields.includes(name) ? Number(value) : value,
    }));
    if (errors[name as keyof ProductFormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSupplierInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSupplierForm(prev => ({ ...prev, [name]: value }));
    
    if (supplierErrors[name as keyof SupplierFormData]) {
      setSupplierErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const addPriceEntry = () => {
    const newEntry: PriceEntry = {
      id: Date.now().toString(),
      price: 0,
      isNew: true,
    };
    setPriceEntries(prev => [...prev, newEntry]);
  };

  const removePriceEntry = async (id: string) => {
    const entry = priceEntries.find(e => e.id === id);
    if (entry?.originalPriceId && !entry.isNew) {
      // Delete existing price from backend
      try {
        await productService.deletePrice(entry.originalPriceId);
        addNotification({
          type: 'success',
          title: 'Precio eliminado',
          message: 'El precio se ha eliminado correctamente',
        });
      } catch (error: unknown) {
        let errorMessage = 'Error al eliminar el precio';
        
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
        return; // Don't remove from UI if backend deletion failed
      }
    }
    
    setPriceEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const updatePriceEntry = (id: string, field: keyof PriceEntry, value: number | undefined) => {
    setPriceEntries(prev => prev.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const handleCreateSupplier = async () => {
    if (!validateSupplierForm()) return;

    try {
      const newSupplier = await productService.createSupplier(supplierForm as CreateSupplierRequest);
      setSuppliers(prev => [...prev, newSupplier]);
      setShowSupplierForm(false);
      setSupplierForm({ name: '', contact: '', location: '' });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (priceEntries.length > 0 && !validatePriceEntries()) return;

    try {
      // Update product
      await productService.updateProduct(parseInt(id!), formData);
      
      // Handle prices
      for (const entry of priceEntries) {
        if (entry.isNew && entry.supplierId && entry.price > 0) {
          // Create new price
          const priceData: CreatePriceRequest = {
            productId: parseInt(id!),
            supplierId: entry.supplierId,
            price: Number(entry.price),
          };
          await productService.createPrice(priceData);
        } else if (!entry.isNew && entry.originalPriceId) {
          // Update existing price
          await productService.updatePrice(entry.originalPriceId, {
            supplierId: entry.supplierId,
            price: Number(entry.price),
          });
        }
      }

      addNotification({
        type: 'success',
        title: 'Producto actualizado',
        message: 'El producto se ha actualizado correctamente',
      });
      navigate(`/products/${id}`);
    } catch (error: unknown) {
      let errorMessage = 'Error al actualizar el producto';
      
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

  const handleBack = () => {
    navigate(`/products/${id}`);
  };

  if (!product) {
    return (
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto">
        {/* Mobile Header - Compact */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={handleBack}
            className="mb-3 sm:mb-4 -ml-2"
            size="sm"
          >
            Volver
          </Button>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                  Editar producto
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  Modifica la información del producto y sus precios
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form - Mobile Optimized */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Information */}
            <div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Información del producto
              </h3>
              {/* Mobile: Stack inputs vertically */}
              <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-2 sm:gap-4 lg:gap-6">
                <div className="sm:col-span-2 lg:col-span-1">
                  <Input
                    label="Nombre del producto"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    error={errors.name}
                    placeholder="Ej: Nombre del producto"
                    required
                  />
                </div>

                <Input
                  label="Código del producto"
                  name="code"
                  type="text"
                  value={formData.code}
                  onChange={handleInputChange}
                  error={errors.code}
                  placeholder="Ej: PROD001"
                  required
                />

                <Input
                  label="Unidad"
                  name="unit"
                  type="text"
                  value={formData.unit}
                  onChange={handleInputChange}
                  error={errors.unit}
                  placeholder="Ej: kg, litros, unidades"
                  required
                />
                <Input
                  label="Precio de venta"
                  name="salePrice"
                  type="number"
                  value={formData.salePrice === 0 ? '' : String(formData.salePrice)}
                  onChange={handleInputChange}
                  error={errors.salePrice}
                  placeholder="Ej: 100.00"
                  required
                />
              </div>
            </div>

            {/* Stock — solo admin */}
            {isAdmin && (
              <div className="border-t pt-6">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Warehouse className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Inventario
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Stock actual"
                    name="stock"
                    type="number"
                    value={String(formData.stock)}
                    onChange={handleInputChange}
                    placeholder="0"
                  />
                  <Input
                    label="Stock mínimo"
                    name="minStock"
                    type="number"
                    value={String(formData.minStock)}
                    onChange={handleInputChange}
                    placeholder="0"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Modifica directamente el stock solo para correcciones manuales. Para compras usa Órdenes de Compra.
                </p>
              </div>
            )}

            {/* Price Section - Mobile Optimized */}
            <div className="border-t pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 flex items-center">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Precios del producto
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  icon={Plus}
                  onClick={addPriceEntry}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  Agregar precio
                </Button>
              </div>

              {priceEntries.length > 0 && (
                <div className="space-y-4">
                  {/* Price Entries - Mobile Optimized */}
                  {priceEntries.map((entry, index) => (
                    <div key={entry.id} className="p-3 sm:p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-900">
                          Precio #{index + 1} {entry.isNew ? '(Nuevo)' : '(Existente)'}
                        </h4>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removePriceEntry(entry.id)}
                          size="sm"
                          className="text-red-600 hover:text-red-700 -mr-2"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Mobile: Stack supplier and price vertically */}
                      <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                        {/* Supplier Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Proveedor
                          </label>
                          <div className="space-y-2 sm:space-y-0 sm:flex sm:space-x-2">
                            <select
                              value={entry.supplierId?.toString() || ''}
                              onChange={(e) => updatePriceEntry(entry.id, 'supplierId', e.target.value ? parseInt(e.target.value) : undefined)}
                              className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                              <option value="">Seleccionar proveedor</option>
                              {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id.toString()}>
                                  {supplier.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              icon={Plus}
                              onClick={() => setShowSupplierForm(true)}
                              size="sm"
                              className="w-full sm:w-auto"
                            >
                              Nuevo
                            </Button>
                          </div>
                          {priceErrors.supplierId && (
                            <p className="mt-1 text-sm text-red-600">{priceErrors.supplierId}</p>
                          )}
                        </div>

                        {/* Price Input */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Precio
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={entry.price === 0 ? '' : String(entry.price)}
                              onChange={(e) => {
                                const value = e.target.value;
                                const numValue = value === '' ? 0 : parseFloat(value);
                                updatePriceEntry(entry.id, 'price', isNaN(numValue) ? 0 : numValue);
                              }}
                              step="0.01"
                              min="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              placeholder="0.00"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 text-sm">$</span>
                            </div>
                          </div>
                          {priceErrors.price && (
                            <p className="mt-1 text-sm text-red-600">{priceErrors.price}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* New Supplier Form - Mobile Optimized */}
              {showSupplierForm && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm sm:text-base font-medium text-gray-900 flex items-center">
                      <Building className="w-4 h-4 mr-2" />
                      Nuevo proveedor
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowSupplierForm(false)}
                      size="sm"
                      className="-mr-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Mobile: Stack supplier form fields */}
                  <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <Input
                        label="Nombre"
                        name="name"
                        type="text"
                        value={supplierForm.name}
                        onChange={handleSupplierInputChange}
                        error={supplierErrors.name}
                        placeholder="Nombre del proveedor"
                      />
                    </div>
                    <Input
                      label="Contacto"
                      name="contact"
                      type="text"
                      value={supplierForm.contact}
                      onChange={handleSupplierInputChange}
                      error={supplierErrors.contact}
                      placeholder="Teléfono o email"
                    />
                    <div className="sm:col-span-2 lg:col-span-1">
                      <Input
                        label="Ubicación"
                        name="location"
                        type="text"
                        value={supplierForm.location}
                        onChange={handleSupplierInputChange}
                        error={supplierErrors.location}
                        placeholder="Ciudad o dirección"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      icon={Plus}
                      onClick={handleCreateSupplier}
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      Crear proveedor
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile: Stack buttons vertically, make them full width */}
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={loading}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                icon={Save}
                loading={loading}
                disabled={loading}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {loading ? 'Actualizando...' : 'Actualizar producto'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProductEdit; 