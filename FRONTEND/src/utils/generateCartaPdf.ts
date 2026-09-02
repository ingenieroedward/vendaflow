import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// PDF "carta" (Letter) nativo — dibujado con las primitivas de jsPDF
// (texto, líneas, rectángulos) + jspdf-autotable para la tabla de productos.
// NO se genera a partir de una captura de HTML (como hacía antes OrderDetail.tsx
// vía html2canvas + medir filas del DOM) — así la paginación, el alto de fila y
// el ajuste de texto los calcula el propio jsPDF/autoTable a partir del
// contenido real, sin adivinar constantes ni dejar hueco en blanco al final de
// órdenes cortas. Portado de JJLM (repo hermano), adaptado a Merco: el logo del
// tenant es una URL remota (no ya viene en base64 como en JJLM) — el caller
// (OrderDetail.tsx/Pos.tsx) debe resolverlo a data-URL antes de pasarlo acá.

export interface CartaPdfItem {
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface CartaPdfCustomer {
  name: string;
  code?: string | number | null;
  nit?: string | null;
  contact?: string | null;
  address?: string | null;
}

// Datos del negocio (tenant) — desacoplado del tipo Tenant a propósito, para
// que este util no dependa de la forma exacta del store.
export interface CartaPdfBusiness {
  name: string;
  nit?: string | null;
  address?: string | null;
  phone?: string | null;
  city?: string | null;
  logo?: string | null; // data-URL ya resuelta (PNG/JPEG), no una URL remota
}

export interface CartaPdfOptions {
  business: CartaPdfBusiness;
  docTypeLabel: string; // "Orden de Venta" | "Cotización"
  docNumber: string; // orderNumber | quoteNumber
  statusLabel: string;
  statusColor: [number, number, number];
  createdAt: string;
  extraInfoLine?: string; // ej. "Válida hasta: ..."
  customer: CartaPdfCustomer;
  items: CartaPdfItem[];
  notes?: string | null;
  totalLabel: string; // "TOTAL" | "TOTAL COTIZADO"
  footerNote?: string; // ej. "Este documento no constituye una factura"
}

// Paleta "formato factura"
const BOX_BORDER: [number, number, number] = [169, 198, 232];
const BOX_BG: [number, number, number] = [238, 245, 252];
const LABEL_COLOR: [number, number, number] = [59, 110, 165];
const TEXT_DARK: [number, number, number] = [17, 24, 39];
const TEXT_GRAY: [number, number, number] = [75, 85, 99];
const TEXT_GRAY_LIGHT: [number, number, number] = [107, 114, 128];

const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

const fmtDateLong = (d: string) => format(new Date(d), "dd 'de' MMMM 'de' yyyy (EEEE)", { locale: es });
const fmtDateTime = (d: string) => format(new Date(d), "dd/MM/yyyy HH:mm", { locale: es });

// El logo del tenant es una URL remota (campo libre en TenantSettings), no una
// data-URL como en JJLM — jsPDF necesita el data-URL para addImage(). Tolerante
// a que la URL no tenga CORS habilitado o falle: null en vez de reventar el PDF
// (mismo nivel de tolerancia que loadImageSize/el catch de más abajo).
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("No se pudo leer el logo"));
    img.src = dataUrl;
  });
}

// Async porque necesita conocer las dimensiones reales del logo (para no
// deformarlo) antes de poder dibujarlo — jsPDF exige ancho/alto explícitos.
export async function generateCartaPdf(opts: CartaPdfOptions): Promise<jsPDF> {
  const { business, docTypeLabel, docNumber, statusLabel, statusColor, createdAt, extraInfoLine, customer, items, notes, totalLabel, footerNote } = opts;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const rightX = pageW - marginX;

  let y = 16;

  // ── Datos del negocio ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...TEXT_DARK);
  doc.text(business.name, marginX, y);
  y += 5.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_GRAY);
  const businessLines = [
    business.nit ? `NIT: ${business.nit}` : null,
    business.address || null,
    business.phone ? `Tfno: ${business.phone}` : null,
    business.city || null,
  ].filter((l): l is string => !!l);
  for (const line of businessLines) {
    doc.text(line, marginX, y);
    y += 3.8;
  }

  // Logo (esquina superior derecha, no interfiere con el bloque de texto)
  if (business.logo) {
    try {
      const size = await loadImageSize(business.logo);
      const maxW = 26;
      const maxH = 16;
      let w = maxW;
      let h = (size.height / size.width) * w;
      if (h > maxH) {
        h = maxH;
        w = (size.width / size.height) * h;
      }
      const fmt = business.logo.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(business.logo, fmt, rightX - w, 8, w, h);
    } catch {
      // Logo corrupto/ilegible/no descargable — se omite sin bloquear el PDF
    }
  }

  y += 1.5;
  doc.setDrawColor(...BOX_BORDER);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, rightX, y);
  y += 5;

  // ── Fila de cajitas: Tipo/Nº+estado | Fecha | Cliente ──
  const boxTop = y;
  const boxH = 21;
  const col1W = 36;
  const col2W = 46;
  const col3W = pageW - 2 * marginX - col1W - col2W;
  const col2X = marginX + col1W;
  const col3X = col2X + col2W;

  doc.setDrawColor(...BOX_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(marginX, boxTop, col1W, boxH);
  doc.rect(col2X, boxTop, col2W, boxH);
  doc.rect(col3X, boxTop, col3W, boxH);

  doc.setFillColor(...BOX_BG);
  doc.rect(marginX, boxTop, col1W, 4.5, "F");
  doc.rect(col2X, boxTop, col2W, 4.5, "F");
  doc.rect(col3X, boxTop, col3W, 4.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...LABEL_COLOR);
  doc.text(docTypeLabel.toUpperCase(), marginX + 2, boxTop + 3.1);
  doc.text("FECHA", col2X + 2, boxTop + 3.1);
  doc.text("CLIENTE", col3X + 2, boxTop + 3.1);

  // Tipo/Nº + estado
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...TEXT_GRAY_LIGHT);
  doc.text("Nº", marginX + 2, boxTop + 8.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_DARK);
  doc.text(docNumber, marginX + 2, boxTop + 13.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...statusColor);
  doc.text(statusLabel.toUpperCase(), marginX + 2, boxTop + 18);

  // Fecha
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text(fmtDateLong(createdAt), col2X + 2, boxTop + 9, { maxWidth: col2W - 4 });
  if (extraInfoLine) {
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_GRAY_LIGHT);
    doc.text(extraInfoLine, col2X + 2, boxTop + 16, { maxWidth: col2W - 4 });
  }

  // Cliente
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT_DARK);
  const customerTitle = customer.code ? `${customer.code}   ${customer.name}` : customer.name;
  doc.text(customerTitle, col3X + 2, boxTop + 8, { maxWidth: col3W - 4 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_GRAY);
  let cy = boxTop + 12;
  const customerLines = [
    customer.nit ? `NIT: ${customer.nit}` : null,
    customer.contact ? `Tfno: ${customer.contact}` : null,
    customer.address || null,
  ].filter((l): l is string => !!l);
  for (const line of customerLines) {
    doc.text(line, col3X + 2, cy, { maxWidth: col3W - 4 });
    cy += 3.2;
  }

  y = boxTop + boxH + 5;

  // ── Tabla de productos (autoTable maneja paginación y alto de fila solo) ──
  autoTable(doc, {
    startY: y,
    head: [["Código", "Descripción", "Cant.", "Precio", "IVA", "Importe"]],
    body: items.map((item) => {
      const base = item.quantity * item.unitPrice;
      const tax = base * ((item.taxRate || 0) / 100);
      return [
        item.code,
        item.name,
        String(item.quantity),
        cop(item.unitPrice),
        item.taxRate ? `${item.taxRate}%` : "—",
        cop(base + tax),
      ];
    }),
    theme: "grid",
    margin: { left: marginX, right: marginX },
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      lineColor: BOX_BORDER,
      lineWidth: 0.2,
      textColor: TEXT_DARK,
    },
    headStyles: {
      fillColor: BOX_BG,
      textColor: LABEL_COLOR,
      fontStyle: "bold",
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 28, font: "courier", textColor: TEXT_GRAY_LIGHT },
      2: { halign: "center", cellWidth: 14 },
      3: { halign: "right", cellWidth: 24 },
      4: { halign: "right", cellWidth: 16, textColor: TEXT_GRAY_LIGHT },
      5: { halign: "right", cellWidth: 28, fontStyle: "bold" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalY = ((doc as any).lastAutoTable?.finalY ?? y) + 6;

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalTax = items.reduce((sum, item) => sum + item.quantity * item.unitPrice * ((item.taxRate || 0) / 100), 0);
  const total = subtotal + totalTax;

  const totalBoxH = 14 + (subtotal !== total ? 4 : 0) + (totalTax > 0 ? 4 : 0);
  const notesH = notes ? Math.min(30, 10 + doc.splitTextToSize(notes, 110).length * 3.6) : 0;
  const blockH = Math.max(totalBoxH, notesH) + 4;

  if (finalY + blockH > pageH - 18) {
    doc.addPage();
    finalY = 20;
  }

  // Notas (izquierda)
  if (notes) {
    const notesW = pageW - 2 * marginX - 62;
    const lines = doc.splitTextToSize(notes, notesW - 8);
    const boxH2 = 8 + lines.length * 3.6;
    doc.setFillColor(254, 252, 232);
    doc.setDrawColor(253, 230, 138);
    doc.setLineWidth(0.3);
    doc.rect(marginX, finalY, notesW, boxH2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(146, 64, 14);
    doc.text("NOTAS", marginX + 4, finalY + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 53, 15);
    doc.text(lines, marginX + 4, finalY + 9);
  }

  // Total (derecha)
  const totalBoxW = 58;
  const totalBoxX = rightX - totalBoxW;
  let ty = finalY;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_GRAY_LIGHT);
  doc.text(`${items.length} producto${items.length !== 1 ? "s" : ""}`, totalBoxX, ty + 3);
  ty += 6;
  if (subtotal !== total) {
    doc.setTextColor(...TEXT_GRAY);
    doc.text("Subtotal", totalBoxX, ty);
    doc.text(cop(subtotal), rightX, ty, { align: "right" });
    ty += 4;
  }
  if (totalTax > 0) {
    doc.setTextColor(...TEXT_GRAY);
    doc.text("IVA", totalBoxX, ty);
    doc.text(cop(totalTax), rightX, ty, { align: "right" });
    ty += 4;
  }
  doc.setFillColor(...BOX_BG);
  doc.setDrawColor(...BOX_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(totalBoxX, ty, totalBoxW, 10, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...LABEL_COLOR);
  doc.text(totalLabel.toUpperCase(), totalBoxX + 3, ty + 6.5);
  doc.setFontSize(12.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text(cop(total), rightX - 3, ty + 6.7, { align: "right" });

  // ── Numeración de páginas + pie ──
  const pageCount = doc.getNumberOfPages();
  const generatedAt = fmtDateTime(new Date().toISOString());
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    if (pageCount > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT_GRAY_LIGHT);
      doc.text(`Página ${p} de ${pageCount}`, rightX, 10, { align: "right" });
    }
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_GRAY_LIGHT);
    if (footerNote) {
      doc.text(footerNote, marginX, pageH - 10);
    }
    doc.text(`Generado ${generatedAt}`, rightX, pageH - 10, { align: "right" });
  }

  return doc;
}
