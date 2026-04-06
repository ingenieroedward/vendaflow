import React, { useState } from 'react';
import { X, User, Phone, MapPin, Save, Hash } from 'lucide-react';
import { CreateCustomerRequest, Customer } from '../../types/customer';
import { useCustomerStore } from '../../store/customerStore';
import Button from './Button';
import Input from './Input';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface CustomerModalProps {
    onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
}

const CustomerModal: React.FC<CustomerModalProps> = ({
  
  onClose,
  onCustomerCreated
}) => {
  const { createCustomer, loading, error, clearError } = useCustomerStore();
  const [formData, setFormData] = useState({
    name: '',
    nit: '',
    contact: '',
    address: '',
    note: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.nit.trim()) {
      return;
    }

    try {
      const customerData: CreateCustomerRequest = {
        name: formData.name.trim(),
        nit: formData.nit.trim(),
        contact: formData.contact.trim() || undefined,
        address: formData.address.trim() || undefined,
        note: formData.note.trim() || undefined
      };

      const newCustomer = await createCustomer(customerData);
      onCustomerCreated(newCustomer);
      handleClose();
    } catch (error) {
      // Error is handled by the store
      console.error('Error al crear el cliente:', error);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      nit: '',
      contact: '',
      address: '',
      note: ''
    });
    clearError();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <User className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              Registrar nuevo cliente
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <ErrorMessage
              message={error}
              onDismiss={clearError}
            />
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre completo *
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Ingresa el nombre completo"
              required
              icon={User}
            />
          </div>

          {/* NIT / Cédula */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NIT / Cédula *
            </label>
            <Input
              type="text"
              value={formData.nit}
              onChange={(e) => handleInputChange('nit', e.target.value)}
              placeholder="Ej: 900123456-7 o 12345678"
              required
              icon={Hash}
            />
          </div>

          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contacto
            </label>
            <Input
              type="text"
              value={formData.contact}
              onChange={(e) => handleInputChange('contact', e.target.value)}
              placeholder="Email o teléfono"
              icon={Phone}
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dirección
            </label>
            <Input
              type="text"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Calle 123 # 45-67, Ciudad"
              icon={MapPin}
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nota
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => handleInputChange('note', e.target.value)}
              placeholder="Información adicional sobre el cliente..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={Save}
              className="flex-1"
              disabled={loading || !formData.name.trim() || !formData.nit.trim()}
            >
              {loading ? (
                <div className="flex items-center">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Creando...</span>
                </div>
              ) : (
                'Crear'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerModal; 