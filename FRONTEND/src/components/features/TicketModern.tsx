import React, { forwardRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Ticket 80 mm, plantilla "Moderna" (v1.25). La clásica (OrderPrintView /
// QuotePrintView) se conserva y se elige en Configuración o al imprimir.
// Pensado para impresora térmica de 1 bit: todo negro sobre blanco, sin grises
// finos, jerarquía con tamaño y peso de letra en vez de color. Ancho real
// imprimible 72 mm (ver .print-ticket-root en index.css).

export interface TicketItem {
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface TicketModernProps {
  business: { name: string; logoUrl?: string | null; nit?: string | null; address?: string | null; city?: string | null; phone?: string | null };
  docLabel: string;          // "ORDEN DE VENTA" | "COTIZACIÓN" | "VENTA"
  docNumber: string;
  createdAt: string;
  statusLabel?: string;
  extraLines?: string[];     // ej. "Válida hasta 30/11/2026", "Crédito · vence 15/12"
  customer: { name: string; nit?: string | null; contact?: string | null };
  sellerName?: string | null;
  items: TicketItem[];
  notes?: string | null;
  totalLabel?: string;       // "TOTAL" | "TOTAL COTIZADO"
  payment?: { cashReceived?: number | null; change?: number | null } | null;
  footer: string;            // "¡Gracias por su compra!" | "Cotización sin valor fiscal"
}

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const Rule: React.FC<{ strong?: boolean }> = ({ strong }) => (
  <div style={{ borderTop: strong ? "2px solid #000" : "1px dashed #000", margin: "7px 0" }} />
);

const Row: React.FC<{ left: React.ReactNode; right: React.ReactNode; bold?: boolean; size?: number }> = ({ left, right, bold, size = 11 }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: `${size}px`, fontWeight: bold ? 700 : 400, lineHeight: 1.35 }}>
    <span>{left}</span>
    <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{right}</span>
  </div>
);

const TicketModern = forwardRef<HTMLDivElement, TicketModernProps>((p, ref) => {
  const subtotal = p.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const tax = p.items.reduce((s, it) => s + it.quantity * it.unitPrice * ((it.taxRate || 0) / 100), 0);
  const total = subtotal + tax;
  const units = p.items.reduce((s, it) => s + Number(it.quantity), 0);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        fontFamily: "'IBM Plex Sans', Arial, Helvetica, sans-serif",
        fontSize: "11px",
        color: "#000",
        background: "#fff",
        padding: "12px 8px",
        boxSizing: "border-box",
      }}
    >
      {/* Negocio */}
      <div style={{ textAlign: "center" }}>
        {p.business.logoUrl && (
          <img
            src={p.business.logoUrl}
            alt=""
            crossOrigin="anonymous"
            style={{ height: "34px", maxWidth: "160px", objectFit: "contain", margin: "0 auto 4px", display: "block" }}
          />
        )}
        <div style={{ fontSize: "15px", fontWeight: 700, lineHeight: 1.2 }}>{p.business.name}</div>
        {p.business.nit && <div style={{ fontSize: "10px" }}>NIT {p.business.nit}</div>}
        {(p.business.address || p.business.city) && (
          <div style={{ fontSize: "10px" }}>{[p.business.address, p.business.city].filter(Boolean).join(" · ")}</div>
        )}
        {p.business.phone && <div style={{ fontSize: "10px" }}>Tel. {p.business.phone}</div>}
      </div>

      <Rule strong />

      {/* Documento */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1px" }}>{p.docLabel}</div>
        <div style={{ fontSize: "16px", fontWeight: 700 }}>{p.docNumber}</div>
        <div style={{ fontSize: "10px" }}>
          {format(new Date(p.createdAt), "dd/MM/yyyy · HH:mm", { locale: es })}
          {p.statusLabel ? ` · ${p.statusLabel}` : ""}
        </div>
        {p.extraLines?.map((l) => <div key={l} style={{ fontSize: "10px" }}>{l}</div>)}
      </div>

      <Rule />

      {/* Cliente y vendedor */}
      <div style={{ fontSize: "10px", lineHeight: 1.4 }}>
        <div><b>Cliente:</b> {p.customer.name}</div>
        {p.customer.nit && <div><b>NIT/CC:</b> {p.customer.nit}</div>}
        {p.customer.contact && <div><b>Tel.:</b> {p.customer.contact}</div>}
        {p.sellerName && <div><b>Atendió:</b> {p.sellerName}</div>}
      </div>

      <Rule />

      {/* Productos: nombre en una línea, cantidad × precio y total debajo */}
      {p.items.map((it, i) => {
        const base = it.quantity * it.unitPrice;
        const lineTotal = base * (1 + (it.taxRate || 0) / 100);
        return (
          <div key={i} style={{ marginBottom: "5px", breakInside: "avoid", pageBreakInside: "avoid" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, wordBreak: "break-word" }}>{it.name}</div>
            <Row
              size={10}
              left={<span>{Number(it.quantity)} × {money(it.unitPrice)}{it.taxRate ? ` + IVA ${it.taxRate}%` : ""}</span>}
              right={<b>{money(lineTotal)}</b>}
            />
          </div>
        );
      })}

      <Rule />

      <Row left={`${p.items.length} producto${p.items.length !== 1 ? "s" : ""} · ${units} unidad${units !== 1 ? "es" : ""}`} right="" size={10} />
      {tax > 0 && (
        <>
          <Row left="Subtotal" right={money(subtotal)} size={10} />
          <Row left="IVA" right={money(tax)} size={10} />
        </>
      )}
      <div style={{ borderTop: "2px solid #000", marginTop: "5px", paddingTop: "5px" }}>
        <Row left={p.totalLabel ?? "TOTAL"} right={money(total)} bold size={16} />
      </div>
      {p.payment?.cashReceived != null && (
        <div style={{ marginTop: "4px" }}>
          <Row left="Efectivo recibido" right={money(Number(p.payment.cashReceived))} size={10} />
          {p.payment.change != null && <Row left="Cambio" right={money(Number(p.payment.change))} bold size={11} />}
        </div>
      )}

      {p.notes && (
        <>
          <Rule />
          <div style={{ fontSize: "10px" }}><b>Notas:</b> {p.notes}</div>
        </>
      )}

      <Rule />
      <div style={{ textAlign: "center", fontSize: "10px", lineHeight: 1.4 }}>
        <div style={{ fontWeight: 700 }}>{p.footer}</div>
        <div>Documento no válido como factura electrónica</div>
        <div>Impreso {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}</div>
      </div>
    </div>
  );
});

TicketModern.displayName = "TicketModern";

export default TicketModern;
