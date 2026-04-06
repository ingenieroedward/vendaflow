import React, { forwardRef } from "react";
import { Order } from "../../types/order";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface OrderPrintViewProps {
  order: Order;
}

const OrderPrintView = forwardRef<HTMLDivElement, OrderPrintViewProps>(
  ({ order }, ref) => {
    const formatDate = (dateString: string) => {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
      }).format(amount);
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case "pending":
          return "PENDIENTE";
        case "completed":
          return "COMPLETADA";
        case "cancelled":
          return "CANCELADA";
        default:
          return status.toUpperCase();
      }
    };

    // Función mejorada para calcular totales con IVA dinámico
    const calculateOrderTotals = () => {
      let subtotal = 0;
      let totalTax = 0;

      order.items.forEach((item) => {
        const itemSubtotal = item.quantity * item.unitPrice;
        const itemTax = itemSubtotal * ((item.taxRate || 0) / 100);

        subtotal += itemSubtotal;
        totalTax += itemTax;
      });

      return {
        subtotal,
        totalTax,
        total: subtotal + totalTax,
      };
    };

    // Función para agrupar productos por tasa de IVA (para el resumen)
    const getTaxBreakdown = () => {
      const taxGroups: {
        [key: number]: { subtotal: number; tax: number; rate: number };
      } = {};

      order.items.forEach((item) => {
        const rate = item.taxRate || 0;
        const itemSubtotal = item.quantity * item.unitPrice;
        const itemTax = itemSubtotal * (rate / 100);

        if (!taxGroups[rate]) {
          taxGroups[rate] = { subtotal: 0, tax: 0, rate };
        }

        taxGroups[rate].subtotal += itemSubtotal;
        taxGroups[rate].tax += itemTax;
      });

      return Object.values(taxGroups).sort((a, b) => a.rate - b.rate);
    };

    const totals = calculateOrderTotals();
    const taxBreakdown = getTaxBreakdown();

    return (
      <div
        ref={ref}
        className="p-8 bg-white text-black"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">JJLM Sistema</h1>
              <p className="text-gray-600">
                Sistema de Gestión de Productos y Precios
              </p>
              <p className="text-sm text-gray-500">Bogotá, Colombia</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-blue-600">
                ORDEN #{order.orderNumber}
              </h2>
              <p className="text-sm text-gray-600">
                Fecha: {formatDate(order.createdAt)}
              </p>
              <p className="text-sm text-gray-600">
                Estado: {getStatusText(order.status)}
              </p>
            </div>
          </div>
        </div>

        {/* Customer and User Info */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-2 border-b border-gray-300 pb-1">
              DATOS DEL CLIENTE
            </h3>
            <div className="bg-gray-50 p-3 rounded">
              <p className="font-semibold text-gray-900">
                {order.customer?.name ?? `Cliente #${order.customerId}`}
              </p>
              {order.customer?.nit && (
                <p className="text-sm text-gray-700">
                  NIT/CC: {order.customer.nit}
                </p>
              )}
              {order.customer?.contact && (
                <p className="text-sm text-gray-700">
                  Contacto: {order.customer.contact}
                </p>
              )}
              {order.customer?.address && (
                <p className="text-sm text-gray-700">
                  Dirección: {order.customer.address}
                </p>
              )}
              {order.customer?.note && (
                <p className="text-sm text-gray-600 italic">
                  Nota: {order.customer.note}
                </p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-2 border-b border-gray-300 pb-1">
              USUARIO CREADOR
            </h3>
            <div className="bg-gray-50 p-3 rounded">
              <p className="font-semibold text-gray-900">
                {order.user?.username ?? `Usuario #${order.userId}`}
              </p>
              <p className="text-sm text-gray-600">
                Rol: {(order.user?.role ?? 'seller').toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-300 pb-1">
            PRODUCTOS
          </h3>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left font-bold text-sm">
                  Código
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left font-bold text-sm">
                  Producto
                </th>
                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-sm">
                  Cantidad
                </th>
                <th className="border border-gray-300 px-3 py-2 text-right font-bold text-sm">
                  Precio Unit.
                </th>
                <th className="border border-gray-300 px-3 py-2 text-center font-bold text-sm">
                  IVA
                </th>
                <th className="border border-gray-300 px-3 py-2 text-right font-bold text-sm">
                  Subtotal
                </th>
                <th className="border border-gray-300 px-3 py-2 text-right font-bold text-sm">
                  IVA
                </th>
                <th className="border border-gray-300 px-3 py-2 text-right font-bold text-sm">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => {
                const itemSubtotal = item.quantity * item.unitPrice;
                const itemTax = itemSubtotal * ((item.taxRate || 0) / 100);
                const itemTotal = itemSubtotal + itemTax;

                return (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="border border-gray-300 px-3 py-2 text-sm">
                      {item.product.code}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-sm">
                      {item.product.name}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                      {item.quantity}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                      {item.taxRate || 0}%
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                      {formatCurrency(itemSubtotal)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                      {formatCurrency(itemTax)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">
                      {formatCurrency(itemTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-80">
            <div className="border-t-2 border-gray-800 pt-3">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Subtotal (sin IVA):</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>

              {/* Desglose de IVA por tasa */}
              {taxBreakdown.map((taxGroup, index) => (
                <div
                  key={index}
                  className="flex justify-between text-sm text-gray-600 mb-1"
                >
                  <span>IVA ({taxGroup.rate}%):</span>
                  <span>{formatCurrency(taxGroup.tax)}</span>
                </div>
              ))}

              <div className="flex justify-between text-sm text-gray-600 mb-2 font-medium">
                <span>Total IVA:</span>
                <span>{formatCurrency(totals.totalTax)}</span>
              </div>

              <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                <span>TOTAL:</span>
                <span className="text-blue-600">
                  {formatCurrency(totals.total)}
                </span>
              </div>

              {/* Verificación de consistencia */}
              {Math.abs(totals.total - order.totalAmount) > 0.01 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs">
                  <p className="text-yellow-700">
                    Nota: El total calculado ({formatCurrency(totals.total)})
                    difiere del total almacenado (
                    {formatCurrency(order.totalAmount)})
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tax Summary Table */}
        {taxBreakdown.length > 1 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-300 pb-1">
              RESUMEN DE IMPUESTOS
            </h3>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left font-bold text-sm">
                    Tasa IVA
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-bold text-sm">
                    Base Gravable
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-bold text-sm">
                    Valor IVA
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-bold text-sm">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {taxBreakdown.map((taxGroup, index) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="border border-gray-300 px-3 py-2 text-sm">
                      {taxGroup.rate}%
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                      {formatCurrency(taxGroup.subtotal)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                      {formatCurrency(taxGroup.tax)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">
                      {formatCurrency(taxGroup.subtotal + taxGroup.tax)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-200 font-bold">
                  <td className="border border-gray-300 px-3 py-2 text-sm">
                    TOTALES
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                    {formatCurrency(totals.subtotal)}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                    {formatCurrency(totals.totalTax)}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right text-sm text-blue-600">
                    {formatCurrency(totals.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2 border-b border-gray-300 pb-1">
              NOTAS DE LA ORDEN
            </h3>
            <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-500">
              <p className="text-sm text-gray-700">
                {order.notes.split("\n").map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t-2 border-gray-800 pt-4 mt-8">
          <div className="text-center text-sm text-gray-600">
            <p>Documento generado el {formatDate(new Date().toISOString())}</p>
            <p>JJLM Sistema - Sistema de Gestión de Productos y Precios</p>
            <p className="text-xs mt-1">
              Este documento es generado automáticamente por el sistema
            </p>
          </div>
        </div>
      </div>
    );
  }
);

OrderPrintView.displayName = "OrderPrintView";

export default OrderPrintView;
