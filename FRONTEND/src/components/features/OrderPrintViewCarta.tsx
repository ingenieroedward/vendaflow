import React, { forwardRef } from "react";
import { Order } from "../../types/order";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTenantStore } from "../../store/tenantStore";

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
  const tenant = useTenantStore(s => s.tenant);
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
        padding: "32px 56px 48px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* ── Header: una sola línea compacta ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {tenant?.logoUrl && (
            <img src={tenant.logoUrl} alt={tenant.name} crossOrigin="anonymous" style={{ height: "24px", maxWidth: "120px", objectFit: "contain" }} />
          )}
          <div style={{ fontSize: "18px", fontWeight: "900", letterSpacing: "-0.5px", color: "#111827" }}>{tenant?.name ?? "Merco"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "10px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", marginRight: "8px" }}>Orden de Venta</span>
          <span style={{ fontSize: "15px", fontWeight: "800", color: "#111827" }}>#{order.orderNumber}</span>
          <span style={{
            marginLeft: "8px",
            fontSize: "9px",
            fontWeight: "700",
            textTransform: "uppercase",
            color: statusColor[status] ?? "#374151",
          }}>
            {statusLabel[status] ?? status}
          </span>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ borderTop: "1.5px solid #111827", marginBottom: "8px" }} />

      {/* ── Meta + Cliente en una sola línea ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", fontSize: "10px", color: "#6b7280" }}>
        {/* Cliente */}
        <div>
          <span style={{ fontWeight: "700", color: "#111827", fontSize: "12px" }}>
            {order.customer?.name ?? `Cliente #${order.customerId}`}
          </span>
          <span style={{ color: "#9ca3af", margin: "0 6px" }}>·</span>
          {(order.customer as any)?.nit && <span style={{ marginRight: "8px" }}>NIT: {(order.customer as any).nit}</span>}
          {order.customer?.contact && <span style={{ marginRight: "8px" }}>Tel: {order.customer.contact}</span>}
          {order.customer?.address && <span style={{ marginRight: "8px" }}>{order.customer.address}</span>}
          {(order.customer as any)?.code && <span>Cód: {(order.customer as any).code}</span>}
        </div>
        {/* Fecha / vendedor */}
        <div style={{ textAlign: "right", whiteSpace: "nowrap", flexShrink: 0, marginLeft: "16px" }}>
          <span>{fmtDate(order.createdAt)}</span>
          {order.user?.username && <span style={{ marginLeft: "12px" }}>Vendedor: <strong>{order.user.username}</strong></span>}
        </div>
      </div>

      {/* ── Products table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
        <thead>
          <tr style={{ background: "#111827", color: "#fff" }}>
            <th style={{ padding: "5px 7px", textAlign: "left", fontWeight: "600" }}>#</th>
            <th style={{ padding: "5px 7px", textAlign: "left", fontWeight: "600" }}>Producto</th>
            <th style={{ padding: "5px 7px", textAlign: "left", fontWeight: "600" }}>Código</th>
            <th style={{ padding: "5px 7px", textAlign: "center", fontWeight: "600" }}>Cant.</th>
            <th style={{ padding: "5px 7px", textAlign: "right", fontWeight: "600" }}>Precio Unit.</th>
            <th style={{ padding: "5px 7px", textAlign: "right", fontWeight: "600" }}>IVA</th>
            <th style={{ padding: "5px 7px", textAlign: "right", fontWeight: "600" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => {
            const base = item.quantity * item.unitPrice;
            const tax = base * ((item.taxRate || 0) / 100);
            const rowBg = i % 2 === 0 ? "#fff" : "#f9fafb";
            return (
              <tr key={i} style={{ background: rowBg, borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "5px 7px", color: "#9ca3af" }}>{i + 1}</td>
                <td style={{ padding: "5px 7px", fontWeight: "500", color: "#111827" }}>{item.product.name}</td>
                <td style={{ padding: "5px 7px", color: "#6b7280", fontFamily: "monospace" }}>{item.product.code}</td>
                <td style={{ padding: "5px 7px", textAlign: "center" }}>{item.quantity}</td>
                <td style={{ padding: "5px 7px", textAlign: "right" }}>{cop(item.unitPrice)}</td>
                <td style={{ padding: "5px 7px", textAlign: "right", color: "#6b7280" }}>
                  {item.taxRate ? `${item.taxRate}%` : "—"}
                </td>
                <td style={{ padding: "5px 7px", textAlign: "right", fontWeight: "600" }}>{cop(base + tax)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {subtotal !== total && (
            <tr style={{ borderTop: "6px solid #fff" }}>
              <td colSpan={5} />
              <td style={{ padding: "4px 7px", color: "#6b7280", textAlign: "right" }}>Subtotal</td>
              <td style={{ padding: "4px 7px", color: "#4b5563", textAlign: "right", fontWeight: "600" }}>{cop(subtotal)}</td>
            </tr>
          )}
          {totalTax > 0 && (
            <tr>
              <td colSpan={5} />
              <td style={{ padding: "4px 7px", color: "#6b7280", textAlign: "right" }}>IVA</td>
              <td style={{ padding: "4px 7px", color: "#4b5563", textAlign: "right", fontWeight: "600" }}>{cop(totalTax)}</td>
            </tr>
          )}
          <tr style={{ background: "#111827", borderTop: subtotal === total ? "6px solid #fff" : undefined }}>
            <td colSpan={5} style={{ padding: "6px 7px", color: "#9ca3af" }}>
              {order.items.length} producto{order.items.length !== 1 ? "s" : ""}
            </td>
            <td style={{ padding: "6px 7px", color: "#fff", fontWeight: "700", textAlign: "right", whiteSpace: "nowrap" }}>TOTAL FACTURA</td>
            <td style={{ padding: "6px 7px", color: "#fff", fontSize: "12px", fontWeight: "800", textAlign: "right", whiteSpace: "nowrap" }}>{cop(total)}</td>
          </tr>
        </tfoot>
      </table>

      {/* ── Notes ── */}
      {order.notes && (
        <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: "6px", padding: "12px 16px", marginBottom: "24px" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", color: "#92400e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Notas</div>
          <div style={{ fontSize: "11px", color: "#78350f" }}>{order.notes}</div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ position: "absolute", bottom: "40px", left: "56px", right: "56px", borderTop: "1px solid #e5e7eb", paddingTop: "12px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#9ca3af" }}>
        <span>{tenant?.name ?? "Merco"} · Sistema de Gestión de Ventas</span>
        <span>{order.items.length} producto{order.items.length !== 1 ? "s" : ""} · Generado {fmt(new Date().toISOString())}</span>
      </div>
    </div>
  );
});

OrderPrintViewCarta.displayName = "OrderPrintViewCarta";
export default OrderPrintViewCarta;
