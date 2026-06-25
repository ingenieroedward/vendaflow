import React, { useState } from 'react';
import { X, User, Phone, MapPin, Save, Hash, Tag } from 'lucide-react';
import { CreateCustomerRequest, Customer, UpdateCustomerRequest } from '../../types/customer';
import { useCustomerStore } from '../../store/customerStore';
import Button from './Button';
import Input from './Input';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface CustomerModalProps {
  onClose: () => void;
  onCustomerCreated?: (customer: Customer) => void;
  onCustomerUpdated?: (customer: Customer) => void;
  editCustomer?: Customer;
}

const CustomerModal: React.FC<CustomerModalProps> = ({
  onClose,
  onCustomerCreated,
  onCustomerUpdated,
  editCustomer,
}) => {
  const { createCustomer, updateCustomer, loading, error, clearError } = useCustomerStore();
  const isEdit = !!editCustomer;

  const [formData, setFormData] = useState({
    code: editCustomer?.code ?? '',
    name: editCustomer?.name ?? '',
    nit: editCustomer?.nit ?? '',
    contact: editCustomer?.contact ?? '',
    address: editCustomer?.address ?? '',
    note: editCustomer?.note ?? '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (isEdit && editCustomer) {
        const updateData: UpdateCustomerRequest = {
          code: formData.code.trim() || null,
          name: formData.name.trim(),
          nit: formData.nit.trim() || null,
          contact: formData.contact.trim() || null,
          address: formData.address.trim() || null,
          note: formData.note.trim() || null,
        };
        await updateCustomer(editCustomer.id, updateData);
        onCustomerUpdated?.({ ...editCustomer, ...updateData });
      } else {
        const customerData: CreateCustomerRequest = {
          code: formData.code.trim() || null,
          name: formData.name.trim(),
          nit: formData.nit.trim() || undefined,
          contact: formData.contact.trim() || undefined,
          address: formData.address.trim() || undefined,
          note: formData.note.trim() || undefined,
        };
        const newCustomer = await createCustomer(customerData);
        onCustomerCreated?.(newCustomer);
      }
      handleClose();
    } catch {
      // Error handled by store
    }
  };

  const handleClose = () => {
    setFormData({ code: '', name: '', nit: '', contact: '', address: '', note: '' });
    clearError();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <User className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Editar cliente' : 'Registrar nuevo cliente'}
            </h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <ErrorMessage message={error} onDismiss={clearError} />}

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código <span className="text-gray-400 font-normal">(opcional, único)</span>
            </label>
            <Input
              type="text"
              value={formData.code}
              onChange={(e) => handleInputChange('code', e.target.value)}
              placeholder="Ej: CLI-001, EMPRESA-A"
              icon={Tag}
            />
          </div>

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

          {/* NIT */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NIT / Cédula <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <Input
              type="text"
              value={formData.nit}
              onChange={(e) => handleInputChange('nit', e.target.value)}
              placeholder="Ej: 900123456-7 o 12345678"
              icon={Hash}
            />
          </div>

          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contacto</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
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
              <span className={`ml-2 text-xs font-normal ${formData.note.length > 230 ? 'text-orange-500' : 'text-gray-400'}`}>
                {formData.note.length}/255
              </span>
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => handleInputChange('note', e.target.value)}
              placeholder="Información adicional sobre el cliente..."
              rows={3}
              maxLength={255}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1" disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={Save}
              className="flex-1"
              disabled={loading || !formData.name.trim()}
            >
              {loading ? (
                <div className="flex items-center">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">{isEdit ? 'Guardando...' : 'Creando...'}</span>
                </div>
              ) : isEdit ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerModal;
