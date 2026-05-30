import React, { forwardRef } from "react";
import { Order } from "../../types/order";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface OrderPrintViewProps {
  order: Order;
}

// Diseño para ticket de 80mm (~302px a 96dpi)
// Columnas estrechas, sin grid, sin tablas complejas
const OrderPrintView = forwardRef<HTMLDivElement, OrderPrintViewProps>(
  ({ order }, ref) => {
    const formatDate = (d: string) =>
      format(new Date(d), "dd/MM/yyyy HH:mm", { locale: es });

    const formatCurrency = (n: number) =>
      new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

    const statusLabel: Record<string, string> = {
      pending: "Pendiente",
      processing: "En Proceso",
      completed: "Completada",
      cancelled: "Cancelada",
    };

    const calculateTotals = () => {
      let subtotal = 0, totalTax = 0;
      order.items.forEach((item) => {
        const base = item.quantity * item.unitPrice;
        subtotal += base;
        totalTax += base * ((item.taxRate || 0) / 100);
      });
      return { subtotal, totalTax, total: subtotal + totalTax };
    };

    const totals = calculateTotals();

    const line = (
      <div style={{ borderTop: "1px dashed #aaa", margin: "6px 0" }} />
    );

    return (
      <div
        ref={ref}
        style={{
          width: "100%",
          fontFamily: "'Courier New', 'Courier', monospace",
          fontSize: "11px",
          color: "#000",
          background: "#fff",
          padding: "12px 8px",
          boxSizing: "border-box",
        }}
      >
        {/* Encabezado */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "1px" }}>JJLM</div>
          <div style={{ fontSize: "9px", color: "#555" }}>SISTEMA DE GESTIÓN DE VENTAS</div>
        </div>

        {line}

        {/* Número de orden y fecha */}
        <div style={{ textAlign: "center", marginBottom: "4px" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold" }}>{order.orderNumber}</div>
          <div style={{ fontSize: "9px", color: "#555" }}>{formatDate(order.createdAt)}</div>
          <div style={{ fontSize: "9px", fontWeight: "bold", marginTop: "2px" }}>
            Estado: {statusLabel[order.status] ?? order.status}
          </div>
        </div>

        {line}

        {/* Cliente */}
        <div style={{ marginBottom: "4px" }}>
          <div style={{ fontSize: "9px", color: "#555", textTransform: "uppercase", marginBottom: "2px" }}>Cliente</div>
          <div style={{ fontWeight: "bold" }}>{order.customer?.name ?? `Cliente #${order.customerId}`}</div>
          {order.customer?.nit && <div style={{ fontSize: "10px" }}>NIT: {order.customer.nit}</div>}
          {order.customer?.contact && <div style={{ fontSize: "10px" }}>Tel: {order.customer.contact}</div>}
          {(order.customer as any)?.code && <div style={{ fontSize: "10px" }}>Cód: {(order.customer as any).code}</div>}
        </div>

        {/* Vendedor */}
        {order.user?.username && (
          <div style={{ marginBottom: "4px" }}>
            <span style={{ fontSize: "9px", color: "#555" }}>Vendedor: </span>
            <span style={{ fontSize: "10px" }}>{order.user.username}</span>
          </div>
        )}

        {line}

        {/* Cabecera tabla */}
        <div style={{
          display: "flex",
          fontSize: "9px",
          fontWeight: "bold",
          textTransform: "uppercase",
          color: "#555",
          marginBottom: "4px",
          paddingBottom: "2px",
          borderBottom: "1px solid #aaa",
        }}>
          <span style={{ flex: 3 }}>Producto</span>
          <span style={{ flex: 1, textAlign: "center" }}>Cant</span>
          <span style={{ flex: 2, textAlign: "right" }}>Total</span>
        </div>

        {/* Items */}
        {order.items.map((item, i) => {
          const base = item.quantity * item.unitPrice;
          const tax = base * ((item.taxRate || 0) / 100);
          return (
            <div
              key={i}
              style={{
                paddingBottom: "5px",
                marginBottom: "3px",
                borderBottom: "1px dotted #ddd",
                pageBreakInside: "avoid",
                breakInside: "avoid",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <span style={{ flex: 3, paddingRight: "4px", wordBreak: "break-word" as const }}>
                  {item.product.name}
                </span>
                <span style={{ flex: 1, textAlign: "center" }}>{item.quantity}</span>
                <span style={{ flex: 2, textAlign: "right", fontWeight: "bold" }}>
                  {formatCurrency(base + tax)}
                </span>
              </div>
              <div style={{ fontSize: "9px", color: "#666", marginLeft: "0" }}>
                {item.product.code} · {formatCurrency(item.unitPrice)} c/u
                {item.taxRate ? ` · IVA ${item.taxRate}%` : ""}
              </div>
            </div>
          );
        })}

        {line}

        {/* Totales */}
        <div style={{ marginBottom: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
            <span>Subtotal (sin IVA)</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.totalTax > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
              <span>IVA</span>
              <span>{formatCurrency(totals.totalTax)}</span>
            </div>
          )}
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontWeight: "bold", fontSize: "13px",
            borderTop: "1px solid #000", paddingTop: "4px", marginTop: "2px",
          }}>
            <span>TOTAL</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </div>

        {/* Notas */}
        {order.notes && (
          <>
            {line}
            <div style={{ fontSize: "9px", color: "#555", textTransform: "uppercase", marginBottom: "2px" }}>Notas</div>
            <div style={{ fontSize: "10px" }}>{order.notes}</div>
          </>
        )}

        {line}

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: "9px", color: "#777", marginTop: "4px" }}>
          <div>{order.items.length} producto{order.items.length !== 1 ? "s" : ""}</div>
          <div style={{ marginTop: "2px" }}>Generado: {formatDate(new Date().toISOString())}</div>
        </div>
      </div>
    );
  }
);

OrderPrintView.displayName = "OrderPrintView";

export default OrderPrintView;
