import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Package,
  User,
  ShoppingCart,
  FileText,
} from "lucide-react";
import { useOrderStore } from "../store/orderStore";
import { useProductStore } from "../store/productStore";
import { useCustomerStore } from "../store/customerStore";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorMessage from "../components/ui/ErrorMessage";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import CustomerSearch from "../components/features/CustomerSearch";
import ProductSearch from "../components/features/ProductSearch";
import CustomerModal from "../components/ui/CustomerModal";
import { CreateOrderRequest } from "../types/order";
import { Product } from "../types";
import { Customer } from "../types/customer";

interface OrderItem {
  id: string;
  productId: number;
  quantity: number;
  unitPrice: number;
  taxRate: number; // IVA rate (0-100)
  product: Product;
}

const OrderNew: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createOrder, loading, error, clearError } = useOrderStore();
  const { products, getProducts, loading: productsLoading } = useProductStore();
  const {
    customers,
    getCustomers,
    loading: customersLoading,
  } = useCustomerStore();
  const { addNotification } = useUIStore();

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0); // Default 19% IVA
  const [notes, setNotes] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [includeProducts, setIncludeProducts] = useState(false);

  useEffect(() => {
    getProducts(1, 2000, false);

    getCustomers(1, 2000);
  }, [getProducts, getCustomers]);

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0 || unitPrice <= 0) {
      return;
    }

    const newItem: OrderItem = {
      id: Date.now().toString(),
      productId: selectedProduct.id,
      quantity,
      unitPrice,
      taxRate,
      product: selectedProduct,
    };

    setOrderItems([...orderItems, newItem]);
    setSelectedProduct(null);
    setQuantity(1);
    setUnitPrice(0);
    setTaxRate(0);
  };

  const handleRemoveItem = (id: string) => {
    setOrderItems((prev) => {
      const newItems = prev.filter((item) => item.id !== id);
      // If no more items, hide the products section
      if (newItems.length === 0) {
        setIncludeProducts(false);
      }
      return newItems;
    });
  };

  const handleProductSelect = (product: Product | null) => {
    if (product) {
      setSelectedProduct(product);

      setUnitPrice(product.salePrice);
    } else {
      setSelectedProduct(null);
      setUnitPrice(0);
    }
  };

  const updateOrderItem = (
    id: string,
    field: keyof OrderItem,
    value: number
  ) => {
    setOrderItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const calculateSubtotal = () => {
    return orderItems.reduce(
      (total, item) => total + item.quantity * item.unitPrice,
      0
    );
  };

  const calculateTotalTax = () => {
    return orderItems.reduce((total, item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      return total + itemSubtotal * (item.taxRate / 100);
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTotalTax();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (orderItems.length === 0) {
      addNotification({
        type: "error",
        title: "Error",
        message: "Debes agregar al menos un producto a la orden",
      });
      return;
    }

    if (!selectedCustomer) {
      addNotification({
        type: "error",
        title: "Error",
        message: "Debes seleccionar un cliente",
      });
      return;
    }

    const orderData: CreateOrderRequest = {
      customerId: selectedCustomer.id,
      userId: user?.id,
      items: orderItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
      })),
      notes: notes.trim() || undefined,
    };

    try {
      const newOrder = await createOrder(orderData);
      addNotification({
        type: "success",
        title: "Orden creada",
        message: "La orden se ha creado correctamente",
      });
      navigate(`/orders/${newOrder.id}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al crear la orden';
      addNotification({ type: 'error', title: 'Error', message: msg });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
    }).format(amount);
  };

  const handleCreateCustomer = () => {
    setShowCustomerModal(true);
  };

  const handleCustomerCreated = (newCustomer: Customer) => {
    setSelectedCustomer(newCustomer);
    setShowCustomerModal(false);
  };

  const handleBack = () => {
    navigate("/orders");
  };

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
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                  Nueva orden
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  Crea una nueva orden de venta
                </p>
              </div>
              <div className="text-xs lg:text-sm text-gray-500 text-right">
                <span className="hidden sm:inline">{user?.username} • </span>
                {user?.role}
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <ErrorMessage
            message={error}
            onDismiss={clearError}
            className="mb-4 lg:mb-6"
          />
        )}

        {/* Form - Mobile Optimized */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Information */}
            <div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 flex items-center">
                <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Información del cliente
              </h3>

              {customersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                  <span className="ml-2 text-sm text-gray-500">
                    Cargando clientes...
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <CustomerSearch
                      onCustomerSelect={setSelectedCustomer}
                      selectedCustomer={selectedCustomer}
                      customers={customers}
                      placeholder="Buscar cliente..."
                    />
                  </div>

                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      icon={Plus}
                      onClick={handleCreateCustomer}
                      className="w-full sm:w-auto"
                      size="sm"
                    >
                      Crear nuevo cliente
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Products Section - Mobile Optimized */}
            <div className="border-t pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 flex items-center">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Productos de la orden
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  icon={Plus}
                  onClick={() => {
                    setIncludeProducts(true);
                  }}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  Agregar producto
                </Button>
              </div>

              {includeProducts && (
                <div className="space-y-4">
                  {/* Product Selection */}
                  <div className="p-3 sm:p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Seleccionar producto
                    </h4>

                    <div className="space-y-4">
                      {productsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <LoadingSpinner size="md" />
                          <span className="ml-2 text-sm text-gray-500">
                            Cargando productos...
                          </span>
                        </div>
                      ) : (
                        <ProductSearch
                          onProductSelect={handleProductSelect}
                          selectedProduct={selectedProduct}
                          products={products}
                          placeholder="Buscar producto..."
                        />
                      )}

                      {selectedProduct && (
                        <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                          <div>
                            <Input
                              label="Cantidad"
                              type="number"
                              value={quantity === 0 ? "" : String(quantity)}
                              onChange={(e) =>
                                setQuantity(parseInt(e.target.value) || 0)
                              }
                              min="1"
                              required
                            />
                          </div>

                          <div>
                            <Input
                              label="Precio unitario"
                              type="number"
                              value={unitPrice === 0 ? "" : String(unitPrice)}
                              onChange={(e) =>
                                setUnitPrice(parseFloat(e.target.value) || 0)
                              }
                              min="0"
                              step="0.01"
                              required
                            />
                          </div>

                          <div>
                            <Input
                              label="IVA (%)"
                              type="number"
                              value={taxRate}
                              onChange={(e) =>
                                setTaxRate(parseFloat(e.target.value) || 0)
                              }
                              min="0"
                              max="100"
                              step="0.01"
                              readOnly
                              className="cursor-not-allowed"
                              
                            />
                          </div>

                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="primary"
                              icon={Plus}
                              onClick={handleAddItem}
                              disabled={quantity <= 0 || unitPrice <= 0}
                              className="w-full"
                              size="sm"
                            >
                              Agregar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items List */}
                  {orderItems.length > 0 && (
                    <div className="space-y-4">
                      {orderItems.map((item, index) => (
                        <div
                          key={item.id}
                          className="p-3 sm:p-4 border border-gray-200 rounded-lg bg-gray-50"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-gray-900">
                              Producto #{index + 1}
                            </h4>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleRemoveItem(item.id)}
                              size="sm"
                              className="text-red-600 hover:text-red-700 -mr-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="mb-3">
                            <p className="font-medium text-sm">
                              {item.product.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Código: {item.product.code}
                            </p>
                          </div>

                          {/* Mobile: Stack quantity, price, tax vertically */}
                          <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Cantidad
                              </label>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  updateOrderItem(item.id, "quantity", value);
                                }}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Precio unitario
                              </label>
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  updateOrderItem(item.id, "unitPrice", value);
                                }}
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                IVA (%)
                              </label>
                              <input
                                type="number"
                                value={item.taxRate}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  updateOrderItem(item.id, "taxRate", value);
                                }}
                                min="0"
                                max="100"
                                step="0.01"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex justify-between items-center text-sm">
                              <span>Subtotal:</span>
                              <span>
                                {formatCurrency(item.quantity * item.unitPrice)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span>IVA:</span>
                              <span>
                                {formatCurrency(
                                  item.quantity *
                                    item.unitPrice *
                                    (item.taxRate / 100)
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-semibold">
                              <span>Total:</span>
                              <span className="text-blue-600">
                                {formatCurrency(
                                  item.quantity *
                                    item.unitPrice *
                                    (1 + item.taxRate / 100)
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Order Summary */}
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-sm font-medium text-blue-900 mb-3">
                          Resumen de la orden
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span>Subtotal:</span>
                            <span>{formatCurrency(calculateSubtotal())}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>IVA total:</span>
                            <span>{formatCurrency(calculateTotalTax())}</span>
                          </div>
                          <div className="flex justify-between items-center border-t pt-2">
                            <span className="text-base font-semibold">
                              Total:
                            </span>
                            <span className="text-lg font-bold text-blue-600">
                              {formatCurrency(calculateTotal())}
                            </span>
                          </div>
                          <p className="text-xs text-blue-700 mt-2">
                            {orderItems.length} producto
                            {orderItems.length !== 1 ? "s" : ""} en la orden
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div className="border-t pt-6">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 flex items-center">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Notas adicionales (Opcional)
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                placeholder="Agrega notas adicionales para esta orden..."
              />
            </div>

            {/* Mobile: Stack buttons vertically, make them full width */}
            <div className="flex gap-4 flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-6 border-t">
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
                disabled={
                  loading || orderItems.length === 0 || !selectedCustomer
                }
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {loading ? "Creando..." : "Crear orden"}
              </Button>
            </div>
          </form>
        </div>

        {/* Customer Modal */}
        {showCustomerModal && (
          <CustomerModal
            onClose={() => setShowCustomerModal(false)}
            onCustomerCreated={handleCustomerCreated}
          />
        )}
      </div>
    </div>
  );
};

export default OrderNew;
