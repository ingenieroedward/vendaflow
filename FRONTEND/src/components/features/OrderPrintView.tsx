import React, { forwardRef } from "react";
import { Order } from "../../types/order";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface OrderPrintViewProps {
  order: Order;
}

const S = {
  page: {
    fontFamily: "'Arial', 'Helvetica', sans-serif",
    background: "#ffffff",
    color: "#111827",
    fontSize: "12px",
    lineHeight: "1.5",
    padding: "0",
  } as React.CSSProperties,

  // ── Header ──────────────────────────────────────────────
  headerBand: {
    background: "#111827",
    padding: "22px 32px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  } as React.CSSProperties,

  companyName: {
    color: "#ffffff",
    fontSize: "22px",
    fontWeight: "800",
    letterSpacing: "-0.5px",
    margin: "0 0 2px 0",
  } as React.CSSProperties,

  companySubtitle: {
    color: "#9ca3af",
    fontSize: "10px",
    margin: "0",
    letterSpacing: "0.5px",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  orderNumberBox: {
    textAlign: "right" as const,
  } as React.CSSProperties,

  orderNumber: {
    color: "#ffffff",
    fontSize: "20px",
    fontWeight: "800",
    margin: "0 0 4px 0",
  } as React.CSSProperties,

  orderDate: {
    color: "#9ca3af",
    fontSize: "11px",
    margin: "0",
  } as React.CSSProperties,

  // ── Sub-header strip ────────────────────────────────────
  subHeader: {
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    padding: "10px 32px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  } as React.CSSProperties,

  // ── Body ────────────────────────────────────────────────
  body: {
    padding: "24px 32px",
  } as React.CSSProperties,

  // ── Info cards ──────────────────────────────────────────
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "24px",
  } as React.CSSProperties,

  infoCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    overflow: "hidden",
  } as React.CSSProperties,

  infoCardHeader: {
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    padding: "6px 12px",
    fontSize: "9px",
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: "0.8px",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  infoCardBody: {
    padding: "10px 12px",
  } as React.CSSProperties,

  infoName: {
    fontWeight: "700",
    fontSize: "13px",
    color: "#111827",
    margin: "0 0 4px 0",
  } as React.CSSProperties,

  infoRow: {
    fontSize: "11px",
    color: "#4b5563",
    margin: "0 0 2px 0",
  } as React.CSSProperties,

  infoLabel: {
    color: "#9ca3af",
    fontWeight: "600",
    marginRight: "4px",
  } as React.CSSProperties,

  // ── Section title ───────────────────────────────────────
  sectionTitle: {
    fontSize: "9px",
    fontWeight: "700",
    color: "#374151",
    letterSpacing: "0.8px",
    textTransform: "uppercase" as const,
    marginBottom: "10px",
    paddingBottom: "6px",
    borderBottom: "2px solid #111827",
    display: "inline-block",
  } as React.CSSProperties,

  // ── Table ───────────────────────────────────────────────
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginBottom: "24px",
    fontSize: "11px",
  } as React.CSSProperties,

  th: {
    background: "#1f2937",
    color: "#ffffff",
    fontWeight: "700",
    padding: "8px 10px",
    textAlign: "left" as const,
    fontSize: "10px",
    letterSpacing: "0.3px",
  } as React.CSSProperties,

  thRight: {
    background: "#1f2937",
    color: "#ffffff",
    fontWeight: "700",
    padding: "8px 10px",
    textAlign: "right" as const,
    fontSize: "10px",
    letterSpacing: "0.3px",
  } as React.CSSProperties,

  thCenter: {
    background: "#1f2937",
    color: "#ffffff",
    fontWeight: "700",
    padding: "8px 10px",
    textAlign: "center" as const,
    fontSize: "10px",
    letterSpacing: "0.3px",
  } as React.CSSProperties,

  tdEven: {
    padding: "7px 10px",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    background: "#ffffff",
    pageBreakInside: "avoid",
    breakInside: "avoid",
  } as React.CSSProperties,

  tdOdd: {
    padding: "7px 10px",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    background: "#f9fafb",
    pageBreakInside: "avoid",
    breakInside: "avoid",
  } as React.CSSProperties,

  tdRight: {
    textAlign: "right" as const,
  } as React.CSSProperties,

  tdCenter: {
    textAlign: "center" as const,
  } as React.CSSProperties,

  productCode: {
    fontSize: "10px",
    color: "#6b7280",
    fontFamily: "monospace",
  } as React.CSSProperties,

  // ── Totals ──────────────────────────────────────────────
  totalsWrapper: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "24px",
  } as React.CSSProperties,

  totalsBox: {
    width: "280px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    overflow: "hidden",
  } as React.CSSProperties,

  totalsHeader: {
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    padding: "6px 14px",
    fontSize: "9px",
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: "0.8px",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  totalsBody: {
    padding: "10px 14px",
  } as React.CSSProperties,

  totalsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "3px 0",
    fontSize: "12px",
    color: "#4b5563",
  } as React.CSSProperties,

  totalsFinalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 14px",
    background: "#111827",
    fontSize: "14px",
    fontWeight: "800",
    color: "#ffffff",
  } as React.CSSProperties,

  // ── Notes ───────────────────────────────────────────────
  notesBox: {
    border: "1px solid #fde68a",
    borderLeft: "4px solid #f59e0b",
    borderRadius: "0 6px 6px 0",
    background: "#fffbeb",
    padding: "10px 14px",
    marginBottom: "24px",
    fontSize: "11px",
    color: "#78350f",
  } as React.CSSProperties,

  notesLabel: {
    fontWeight: "700",
    fontSize: "9px",
    color: "#b45309",
    letterSpacing: "0.8px",
    textTransform: "uppercase" as const,
    marginBottom: "4px",
  } as React.CSSProperties,

  // ── Footer ──────────────────────────────────────────────
  footer: {
    borderTop: "1px solid #e5e7eb",
    padding: "12px 32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#f8fafc",
  } as React.CSSProperties,

  footerLeft: {
    fontSize: "9px",
    color: "#9ca3af",
  } as React.CSSProperties,

  footerRight: {
    fontSize: "9px",
    color: "#9ca3af",
    textAlign: "right" as const,
  } as React.CSSProperties,
};

const OrderPrintView = forwardRef<HTMLDivElement, OrderPrintViewProps>(
  ({ order }, ref) => {
    const formatDate = (dateString: string) =>
      format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });

    const formatDateShort = (dateString: string) =>
      format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(amount);

    const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
      pending:    { label: "Pendiente",   bg: "#f3f4f6", color: "#374151" },
      processing: { label: "En Proceso",  bg: "#f3f4f6", color: "#111827" },
      completed:  { label: "Completada",  bg: "#f0fdf4", color: "#166534" },
      cancelled:  { label: "Cancelada",   bg: "#fef2f2", color: "#991b1b" },
    };

    const status = statusConfig[order.status] ?? { label: order.status, bg: "#f3f4f6", color: "#374151" };

    const calculateTotals = () => {
      let subtotal = 0;
      let totalTax = 0;
      order.items.forEach((item) => {
        const base = item.quantity * item.unitPrice;
        subtotal += base;
        totalTax += base * ((item.taxRate || 0) / 100);
      });
      return { subtotal, totalTax, total: subtotal + totalTax };
    };

    const getTaxBreakdown = () => {
      const groups: Record<number, { subtotal: number; tax: number; rate: number }> = {};
      order.items.forEach((item) => {
        const rate = item.taxRate || 0;
        const base = item.quantity * item.unitPrice;
        if (!groups[rate]) groups[rate] = { subtotal: 0, tax: 0, rate };
        groups[rate].subtotal += base;
        groups[rate].tax += base * (rate / 100);
      });
      return Object.values(groups).sort((a, b) => a.rate - b.rate);
    };

    const totals = calculateTotals();
    const taxBreakdown = getTaxBreakdown();

    return (
      <div ref={ref} style={S.page}>

        {/* ── Header band ─────────────────────────────────── */}
        <div style={S.headerBand}>
          <div>
            <p style={S.companyName}>JJLM</p>
            <p style={S.companySubtitle}>Sistema de Gestión de Ventas</p>
          </div>
          <div style={S.orderNumberBox}>
            <p style={S.orderNumber}>{order.orderNumber}</p>
            <p style={S.orderDate}>{formatDateShort(order.createdAt)}</p>
          </div>
        </div>

        {/* ── Sub-header: status ──────────────────────────── */}
        <div style={S.subHeader}>
          <span style={{ fontSize: "10px", color: "#6b7280", fontWeight: "600" }}>ESTADO:</span>
          <span style={{
            background: status.bg,
            color: status.color,
            fontWeight: "700",
            fontSize: "10px",
            padding: "2px 10px",
            borderRadius: "99px",
            letterSpacing: "0.5px",
          }}>
            {status.label.toUpperCase()}
          </span>
          <span style={{ marginLeft: "auto", fontSize: "10px", color: "#9ca3af" }}>
            Generado: {formatDate(new Date().toISOString())}
          </span>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div style={S.body}>

          {/* Info cards */}
          <div style={S.infoGrid}>
            {/* Cliente */}
            <div style={S.infoCard}>
              <div style={S.infoCardHeader}>Cliente</div>
              <div style={S.infoCardBody}>
                <p style={S.infoName}>{order.customer?.name ?? `Cliente #${order.customerId}`}</p>
                {order.customer?.nit && (
                  <p style={S.infoRow}><span style={S.infoLabel}>NIT/CC:</span>{order.customer.nit}</p>
                )}
                {order.customer?.contact && (
                  <p style={S.infoRow}><span style={S.infoLabel}>Contacto:</span>{order.customer.contact}</p>
                )}
                {order.customer?.address && (
                  <p style={S.infoRow}><span style={S.infoLabel}>Dirección:</span>{order.customer.address}</p>
                )}
                {(order.customer as any)?.code && (
                  <p style={S.infoRow}><span style={S.infoLabel}>Código:</span>{(order.customer as any).code}</p>
                )}
              </div>
            </div>

            {/* Vendedor */}
            <div style={S.infoCard}>
              <div style={S.infoCardHeader}>Vendedor</div>
              <div style={S.infoCardBody}>
                <p style={S.infoName}>{order.user?.username ?? `Usuario #${order.userId}`}</p>
                <p style={S.infoRow}>
                  <span style={S.infoLabel}>Rol:</span>
                  {(order.user?.role ?? "seller").charAt(0).toUpperCase() + (order.user?.role ?? "seller").slice(1)}
                </p>
              </div>
            </div>
          </div>

          {/* Products table */}
          <div>
            <span style={S.sectionTitle}>Detalle de productos</span>
          </div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Código</th>
                <th style={{ ...S.th, width: "35%" }}>Producto</th>
                <th style={S.thCenter}>Cant.</th>
                <th style={S.thRight}>Precio Unit.</th>
                <th style={S.thCenter}>IVA</th>
                <th style={S.thRight}>Subtotal</th>
                <th style={S.thRight}>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => {
                const base = item.quantity * item.unitPrice;
                const tax = base * ((item.taxRate || 0) / 100);
                const td = i % 2 === 0 ? S.tdEven : S.tdOdd;
                return (
                  <tr key={i} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td style={td}>
                      <span style={S.productCode}>{item.product.code}</span>
                    </td>
                    <td style={td}>{item.product.name}</td>
                    <td style={{ ...td, ...S.tdCenter }}>{item.quantity}</td>
                    <td style={{ ...td, ...S.tdRight }}>{formatCurrency(item.unitPrice)}</td>
                    <td style={{ ...td, ...S.tdCenter, color: item.taxRate ? "#374151" : "#9ca3af" }}>
                      {item.taxRate || 0}%
                    </td>
                    <td style={{ ...td, ...S.tdRight }}>{formatCurrency(base)}</td>
                    <td style={{ ...td, ...S.tdRight, fontWeight: "700", color: "#111827" }}>
                      {formatCurrency(base + tax)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Notes */}
          {order.notes && (
            <div style={S.notesBox}>
              <p style={S.notesLabel}>Notas</p>
              <p style={{ margin: 0 }}>{order.notes}</p>
            </div>
          )}

          {/* Totals */}
          <div style={S.totalsWrapper}>
            <div style={S.totalsBox}>
              <div style={S.totalsHeader}>Resumen</div>
              <div style={S.totalsBody}>
                <div style={S.totalsRow}>
                  <span>Subtotal (sin IVA)</span>
                  <span style={{ fontWeight: "600", color: "#111827" }}>{formatCurrency(totals.subtotal)}</span>
                </div>
                {taxBreakdown.map((g, i) => (
                  <div key={i} style={S.totalsRow}>
                    <span>IVA {g.rate}%</span>
                    <span style={{ fontWeight: "600", color: "#374151" }}>{formatCurrency(g.tax)}</span>
                  </div>
                ))}
                {taxBreakdown.length > 1 && (
                  <div style={{ ...S.totalsRow, borderTop: "1px solid #e5e7eb", paddingTop: "6px", marginTop: "4px" }}>
                    <span style={{ fontWeight: "600" }}>Total IVA</span>
                    <span style={{ fontWeight: "700", color: "#111827" }}>{formatCurrency(totals.totalTax)}</span>
                  </div>
                )}
              </div>
              <div style={S.totalsFinalRow}>
                <span>TOTAL</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Items count */}
          <p style={{ fontSize: "10px", color: "#9ca3af", margin: "0 0 8px 0" }}>
            {order.items.length} producto{order.items.length !== 1 ? "s" : ""} en esta orden
          </p>
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div style={S.footer}>
          <div style={S.footerLeft}>
            <p style={{ margin: "0 0 2px 0", fontWeight: "600" }}>JJLM · Sistema de Gestión de Ventas</p>
            <p style={{ margin: 0 }}>Documento generado automáticamente · {formatDate(new Date().toISOString())}</p>
          </div>
          <div style={S.footerRight}>
            <p style={{ margin: "0 0 2px 0" }}>{order.orderNumber}</p>
            <p style={{ margin: 0, color: "#ffffff", background: "#374151", padding: "1px 6px", borderRadius: "4px", display: "inline-block" }}>
              {status.label}
            </p>
          </div>
        </div>

      </div>
    );
  }
);

OrderPrintView.displayName = "OrderPrintView";

export default OrderPrintView;
