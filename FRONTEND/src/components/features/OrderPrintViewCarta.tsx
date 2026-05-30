import React, { forwardRef } from "react";
import { Order } from "../../types/order";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  order: Order;
}

const statusLabel: Record<string, string> = {
  pending: "PENDIENTE",
  processing: "EN PROCESO",
  completed: "COMPLETADA",
  cancelled: "CANCELADA",
};

const statusColor: Record<string, string> = {
  pending: "#b45309",
  processing: "#1d4ed8",
  completed: "#15803d",
  cancelled: "#dc2626",
};

// Carta (Letter) invoice layout — renders at 794px (≈ 8.5in @ 96dpi)
const OrderPrintViewCarta = forwardRef<HTMLDivElement, Props>(({ order }, ref) => {
  const fmt = (d: string) => format(new Date(d), "dd/MM/yyyy HH:mm", { locale: es });
  const fmtDate = (d: string) => format(new Date(d), "dd 'de' MMMM 'de' yyyy", { locale: es });
  const cop = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

  let subtotal = 0, totalTax = 0;
  order.items.forEach((item) => {
    const base = item.quantity * item.unitPrice;
    subtotal += base;
    totalTax += base * ((item.taxRate || 0) / 100);
  });
  const total = subtotal + totalTax;

  const status = order.status;

  return (
    <div
      ref={ref}
      style={{
        width: "794px",
        minHeight: "1123px",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "12px",
        color: "#1f2937",
        background: "#fff",
        padding: "48px 56px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        {/* Left: company */}
        <div>
          <div style={{ fontSize: "28px", fontWeight: "900", letterSpacing: "-1px", color: "#111827" }}>JJLM</div>
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>Sistema de Gestión de Ventas</div>
        </div>
        {/* Right: order id + status */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>Orden de Venta</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#111827", marginTop: "2px" }}>#{order.orderNumber}</div>
          <div style={{ marginTop: "6px" }}>
            <span style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: "99px",
              fontSize: "10px",
              fontWeight: "700",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              background: statusColor[status] + "18",
              color: statusColor[status] ?? "#374151",
              border: `1px solid ${statusColor[status] ?? "#d1d5db"}`,
            }}>
              {statusLabel[status] ?? status}
            </span>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ borderTop: "2px solid #111827", marginBottom: "24px" }} />

      {/* ── Meta row: fecha + vendedor ── */}
      <div style={{ display: "flex", gap: "32px", marginBottom: "24px", fontSize: "11px", color: "#6b7280" }}>
        <div>
          <div style={{ fontWeight: "600", color: "#374151", marginBottom: "2px" }}>Fecha</div>
          <div>{fmtDate(order.createdAt)}</div>
        </div>
        {order.user?.username && (
          <div>
            <div style={{ fontWeight: "600", color: "#374151", marginBottom: "2px" }}>Vendedor</div>
            <div>{order.user.username}</div>
          </div>
        )}
        <div>
          <div style={{ fontWeight: "600", color: "#374151", marginBottom: "2px" }}>Generado</div>
          <div>{fmt(new Date().toISOString())}</div>
        </div>
      </div>

      {/* ── Customer box ── */}
      <div style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "16px 20px",
        marginBottom: "28px",
      }}>
        <div style={{ fontSize: "10px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
          Cliente
        </div>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "#111827", marginBottom: "4px" }}>
          {order.customer?.name ?? `Cliente #${order.customerId}`}
        </div>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "11px", color: "#4b5563" }}>
          {(order.customer as any)?.nit && <span>NIT: {(order.customer as any).nit}</span>}
          {order.customer?.contact && <span>Tel: {order.customer.contact}</span>}
          {order.customer?.address && <span>{order.customer.address}</span>}
          {(order.customer as any)?.code && <span>Cód: {(order.customer as any).code}</span>}
        </div>
      </div>

      {/* ── Products table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px", fontSize: "11px" }}>
        <thead>
          <tr style={{ background: "#111827", color: "#fff" }}>
            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "600", borderRadius: "4px 0 0 0" }}>#</th>
            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "600" }}>Producto</th>
            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "600" }}>Código</th>
            <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: "600" }}>Cant.</th>
            <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "600" }}>Precio Unit.</th>
            <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "600" }}>IVA</th>
            <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "600", borderRadius: "0 4px 0 0" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => {
            const base = item.quantity * item.unitPrice;
            const tax = base * ((item.taxRate || 0) / 100);
            const rowBg = i % 2 === 0 ? "#fff" : "#f9fafb";
            return (
              <tr key={i} style={{ background: rowBg, borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "9px 10px", color: "#9ca3af" }}>{i + 1}</td>
                <td style={{ padding: "9px 10px", fontWeight: "500", color: "#111827" }}>{item.product.name}</td>
                <td style={{ padding: "9px 10px", color: "#6b7280", fontFamily: "monospace" }}>{item.product.code}</td>
                <td style={{ padding: "9px 10px", textAlign: "center" }}>{item.quantity}</td>
                <td style={{ padding: "9px 10px", textAlign: "right" }}>{cop(item.unitPrice)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", color: "#6b7280" }}>
                  {item.taxRate ? `${item.taxRate}%` : "—"}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: "600" }}>{cop(base + tax)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "28px" }}>
        <div style={{ width: "240px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "11px", color: "#4b5563", borderBottom: "1px solid #f3f4f6" }}>
            <span>Subtotal (sin IVA)</span>
            <span>{cop(subtotal)}</span>
          </div>
          {totalTax > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "11px", color: "#4b5563", borderBottom: "1px solid #f3f4f6" }}>
              <span>IVA</span>
              <span>{cop(totalTax)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", marginTop: "4px", background: "#111827", color: "#fff", borderRadius: "6px", fontWeight: "700", fontSize: "13px" }}>
            <span>TOTAL</span>
            <span>{cop(total)}</span>
          </div>
        </div>
      </div>

      {/* ── Notes ── */}
      {order.notes && (
        <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: "6px", padding: "12px 16px", marginBottom: "24px" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", color: "#92400e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Notas</div>
          <div style={{ fontSize: "11px", color: "#78350f" }}>{order.notes}</div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ position: "absolute", bottom: "40px", left: "56px", right: "56px", borderTop: "1px solid #e5e7eb", paddingTop: "12px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#9ca3af" }}>
        <span>JJLM · Sistema de Gestión de Ventas</span>
        <span>{order.items.length} producto{order.items.length !== 1 ? "s" : ""} · Generado {fmt(new Date().toISOString())}</span>
      </div>
    </div>
  );
});

OrderPrintViewCarta.displayName = "OrderPrintViewCarta";
export default OrderPrintViewCarta;
