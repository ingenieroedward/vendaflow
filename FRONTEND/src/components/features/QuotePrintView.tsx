import React, { forwardRef } from "react";
import { Quote } from "../../types/quote";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTenantStore } from "../../store/tenantStore";

interface QuotePrintViewProps {
  quote: Quote;
}

// Diseño para ticket de 80mm (~302px a 96dpi) — mirror de OrderPrintView.tsx
const QuotePrintView = forwardRef<HTMLDivElement, QuotePrintViewProps>(
  ({ quote }, ref) => {
    const tenant = useTenantStore(s => s.tenant);
    const formatDate = (d: string) =>
      format(new Date(d), "dd/MM/yyyy HH:mm", { locale: es });

    const formatCurrency = (n: number) =>
      new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

    const statusLabel: Record<string, string> = {
      draft: "Borrador",
      sent: "Enviada",
      accepted: "Aceptada",
      rejected: "Rechazada",
      expired: "Vencida",
      converted: "Convertida",
    };

    const calculateTotals = () => {
      let subtotal = 0, totalTax = 0;
      quote.items.forEach((item) => {
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
          // 8px, no 22px — compensa el ancho imprimible real del cabezal
          // térmico (72mm, no 80mm; ver .print-ticket-root en index.css)
          padding: "12px 8px",
          boxSizing: "border-box",
        }}
      >
        {/* Encabezado — marca del tenant (logo si tiene plan con marca propia) */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          {tenant?.logoUrl && (
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              crossOrigin="anonymous"
              style={{ height: "28px", maxWidth: "140px", objectFit: "contain", margin: "0 auto 4px" }}
            />
          )}
          <div style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "1px" }}>{tenant?.name ?? "Merco"}</div>
          <div style={{ fontSize: "9px", color: "#555" }}>COTIZACIÓN</div>
        </div>

        {line}

        {/* Número de cotización y fecha */}
        <div style={{ textAlign: "center", marginBottom: "4px" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold" }}>{quote.quoteNumber}</div>
          <div style={{ fontSize: "9px", color: "#555" }}>{formatDate(quote.createdAt)}</div>
          <div style={{ fontSize: "9px", fontWeight: "bold", marginTop: "2px" }}>
            Estado: {statusLabel[quote.status] ?? quote.status}
          </div>
          {quote.validUntil && (
            <div style={{ fontSize: "9px", color: "#555" }}>Válida hasta: {format(new Date(quote.validUntil), "dd/MM/yyyy")}</div>
          )}
        </div>

        {line}

        {/* Cliente */}
        <div style={{ marginBottom: "4px" }}>
          <div style={{ fontSize: "9px", color: "#555", textTransform: "uppercase", marginBottom: "2px" }}>Cliente</div>
          <div style={{ fontWeight: "bold" }}>{quote.customer?.name ?? `Cliente #${quote.customerId}`}</div>
          {quote.customer?.nit && <div style={{ fontSize: "10px" }}>NIT: {quote.customer.nit}</div>}
          {quote.customer?.contact && <div style={{ fontSize: "10px" }}>Tel: {quote.customer.contact}</div>}
          {quote.customer?.code && <div style={{ fontSize: "10px" }}>Cód: {quote.customer.code}</div>}
        </div>

        {/* Vendedor */}
        {quote.user?.username && (
          <div style={{ marginBottom: "4px" }}>
            <span style={{ fontSize: "9px", color: "#555" }}>Vendedor: </span>
            <span style={{ fontSize: "10px" }}>{quote.user.username}</span>
          </div>
        )}

        {line}

        {/* Cabecera tabla */}
        <div style={{
          display: "flex",
          gap: "4px",
          fontSize: "9px",
          fontWeight: "bold",
          textTransform: "uppercase",
          color: "#555",
          marginBottom: "4px",
          paddingBottom: "2px",
          borderBottom: "1px solid #aaa",
        }}>
          <span style={{ flex: 1 }}>Producto</span>
          <span style={{ width: "28px", textAlign: "center", flexShrink: 0 }}>Cant</span>
          <span style={{ width: "90px", textAlign: "right", flexShrink: 0 }}>Total</span>
        </div>

        {/* Items */}
        {quote.items.map((item, i) => {
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
                <span style={{ flex: 1, paddingRight: "4px", wordBreak: "break-word" as const }}>
                  <span style={{ fontWeight: "bold", color: "#111", marginRight: "4px" }}>
                    {item.product.code}
                  </span>
                  {item.product.name}
                </span>
                <span style={{ width: "28px", textAlign: "center", flexShrink: 0 }}>{item.quantity}</span>
                <span style={{ width: "90px", textAlign: "right", flexShrink: 0, fontWeight: "bold" }}>
                  {formatCurrency(base + tax)}
                </span>
              </div>
              <div style={{ fontSize: "9px", color: "#555", paddingLeft: "2px" }}>
                {formatCurrency(item.unitPrice)} c/u
                {item.taxRate ? ` · IVA ${item.taxRate}%` : ""}
              </div>
            </div>
          );
        })}

        {line}

        {/* Totales */}
        <div style={{ marginBottom: "8px" }}>
          {totals.subtotal !== totals.total && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
              <span>Subtotal</span>
              <span style={{ flexShrink: 0 }}>{formatCurrency(totals.subtotal)}</span>
            </div>
          )}
          {totals.totalTax > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
              <span>IVA</span>
              <span style={{ flexShrink: 0 }}>{formatCurrency(totals.totalTax)}</span>
            </div>
          )}
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontWeight: "bold", fontSize: "14px",
            borderTop: "2px solid #000", paddingTop: "5px", marginTop: "4px",
          }}>
            <span>TOTAL COTIZADO</span>
            <span style={{ flexShrink: 0 }}>{formatCurrency(totals.total)}</span>
          </div>
        </div>

        {/* Notas */}
        {quote.notes && (
          <>
            {line}
            <div style={{ fontSize: "9px", color: "#555", textTransform: "uppercase", marginBottom: "2px" }}>Notas</div>
            <div style={{ fontSize: "10px" }}>{quote.notes}</div>
          </>
        )}

        {line}

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: "9px", color: "#777", marginTop: "4px" }}>
          <div>{quote.items.length} producto{quote.items.length !== 1 ? "s" : ""}</div>
          <div style={{ marginTop: "2px", fontWeight: "bold" }}>Este documento no constituye una factura</div>
          <div style={{ marginTop: "2px" }}>Generado: {formatDate(new Date().toISOString())}</div>
        </div>
      </div>
    );
  }
);

QuotePrintView.displayName = "QuotePrintView";

export default QuotePrintView;
