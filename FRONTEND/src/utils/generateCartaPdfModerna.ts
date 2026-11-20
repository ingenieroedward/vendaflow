import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CartaPdfOptions } from "./generateCartaPdf";
import { deriveThemeColors } from "./themeColors";
import { pesosEnLetras } from "./numberToWords";

// Plantilla carta "Moderna" (v1.25). La clásica (generateCartaPdf.ts) se
// conserva tal cual y se puede seguir eligiendo en Configuración o al imprimir.
// Diferencias: encabezado con el color del negocio, número y tipo de documento
// grandes a la derecha, tabla sin rejilla con filas alternas, total destacado,
// monto en letras ("SON: … PESOS M/CTE") y pie con los datos de contacto.

type RGB = [number, number, number];

const INK: RGB = [17, 24, 39];
const GRAY: RGB = [75, 85, 99];
const GRAY_SOFT: RGB = [107, 114, 128];
const RULE: RGB = [229, 231, 235];
const ZEBRA: RGB = [249, 250, 251];

const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("No se pudo leer el logo"));
    img.src = dataUrl;
  });
}

export interface CartaModernaExtras {
  /** Color de marca del negocio (#rrggbb); se oscurece si no da contraste */
  accentHex?: string | null;
  /** Vendedor que creó el documento */
  sellerName?: string | null;
  /** Línea de condiciones de pago, ej. "Crédito · vence el 15 de diciembre" */
  paymentLine?: string | null;
}

export async function generateCartaPdfModerna(opts: CartaPdfOptions & CartaModernaExtras): Promise<jsPDF> {
  const { business, docTypeLabel, docNumber, statusLabel, statusColor, createdAt, extraInfoLine, customer, items, notes, totalLabel, footerNote, sellerName, paymentLine } = opts;

  // Acento: el color del negocio en su variante con contraste AA (mismo
  // cálculo que la app); texto encima en blanco u oscuro según convenga
  const theme = deriveThemeColors(opts.accentHex || "#0057ff") ?? deriveThemeColors("#0057ff")!;
  const ACCENT = theme.ink as RGB;
  const ON_ACCENT = theme.onFill as RGB;
  const ACCENT_FILL = theme.fill as RGB;
  const ACCENT_SOFT: RGB = ACCENT.map(c => Math.round(c + (255 - c) * 0.9)) as RGB;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mx = 16;
  const rightX = pageW - mx;

  // Franja de color arriba
  doc.setFillColor(...ACCENT_FILL);
  doc.rect(0, 0, pageW, 3, "F");

  // ── Encabezado: logo + negocio (izq) · tipo y número (der) ──
  let y = 14;
  let textX = mx;
  if (business.logo) {
    try {
      const size = await loadImageSize(business.logo);
      const maxW = 24, maxH = 18;
      let w = maxW, h = (size.height / size.width) * w;
      if (h > maxH) { h = maxH; w = (size.width / size.height) * h; }
      const fmt = business.logo.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(business.logo, fmt, mx, y - 4, w, h);
      textX = mx + w + 5;
    } catch {
      // logo ilegible: se omite sin bloquear el PDF
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(business.name, textX, y, { maxWidth: 95 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  let by = y + 5;
  for (const line of [
    business.nit ? `NIT ${business.nit}` : null,
    [business.address, business.city].filter(Boolean).join(" · ") || null,
    business.phone ? `Tel. ${business.phone}` : null,
  ].filter((l): l is string => !!l)) {
    doc.text(line, textX, by, { maxWidth: 95 });
    by += 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ACCENT);
  doc.text(docTypeLabel.toUpperCase(), rightX, y - 1, { align: "right" });
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(docNumber, rightX, y + 7, { align: "right" });
  // Estado como píldora
  doc.setFontSize(7.5);
  const pillW = doc.getTextWidth(statusLabel.toUpperCase()) + 6;
  doc.setFillColor(...statusColor);
  doc.roundedRect(rightX - pillW, y + 10, pillW, 5, 2.5, 2.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabel.toUpperCase(), rightX - pillW / 2, y + 13.5, { align: "center" });

  y = Math.max(by, y + 18) + 4;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(mx, y, rightX, y);
  y += 7;

  // ── Cliente (izq) · Detalles (der) ──
  const colW = (pageW - 2 * mx - 10) / 2;
  const leftX = mx;
  const detX = mx + colW + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...ACCENT);
  doc.text("CLIENTE", leftX, y);
  doc.text("DETALLES", detX, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(customer.name, leftX, y + 5.5, { maxWidth: colW });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  let cy = y + 10.5;
  for (const line of [
    customer.nit ? `NIT/CC ${customer.nit}` : null,
    customer.code ? `Código ${customer.code}` : null,
    customer.contact ? `Tel. ${customer.contact}` : null,
    customer.address || null,
  ].filter((l): l is string => !!l)) {
    doc.text(line, leftX, cy, { maxWidth: colW });
    cy += 4;
  }

  const details: Array<[string, string]> = [
    ["Fecha", format(new Date(createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })],
  ];
  if (extraInfoLine) {
    const [k, ...v] = extraInfoLine.split(":");
    details.push(v.length ? [k.trim(), v.join(":").trim()] : ["", extraInfoLine]);
  }
  if (paymentLine) details.push(["Pago", paymentLine]);
  if (sellerName) details.push(["Vendedor", sellerName]);
  let dy = y + 5.5;
  for (const [k, v] of details) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY_SOFT);
    if (k) doc.text(k, detX, dy);
    doc.setTextColor(...INK);
    doc.text(v, detX + 22, dy, { maxWidth: colW - 22 });
    dy += 4.6;
  }

  y = Math.max(cy, dy) + 5;

  // ── Productos: sin rejilla, encabezado con el color, filas alternas ──
  autoTable(doc, {
    startY: y,
    head: [["#", "Descripción", "Cant.", "Precio unit.", "IVA", "Total"]],
    body: items.map((item, i) => {
      const base = item.quantity * item.unitPrice;
      const tax = base * ((item.taxRate || 0) / 100);
      return [
        String(i + 1),
        `${item.name}\n${item.code}`,
        String(item.quantity),
        cop(item.unitPrice),
        item.taxRate ? `${item.taxRate}%` : "—",
        cop(base + tax),
      ];
    }),
    theme: "plain",
    margin: { left: mx, right: mx },
    styles: { fontSize: 8.5, cellPadding: { top: 2.4, bottom: 2.4, left: 2, right: 2 }, textColor: INK, valign: "middle" },
    headStyles: { fillColor: ACCENT_FILL, textColor: ON_ACCENT, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: {
      0: { cellWidth: 9, halign: "center", textColor: GRAY_SOFT },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 14, halign: "right", textColor: GRAY },
      5: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
    // Segunda línea de la descripción (el código) más pequeña y gris
    didParseCell: (data) => {
      // títulos alineados igual que sus columnas de números
      if (data.section === "head") {
        const al: Record<number, "center" | "right"> = { 0: "center", 2: "center", 3: "right", 4: "right", 5: "right" };
        if (al[data.column.index]) data.cell.styles.halign = al[data.column.index];
      }
    },
    willDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const [name, code] = String(data.cell.raw).split("\n");
        data.cell.text = [name];
        // el código se dibuja aparte tras la celda (ver didDrawCell)
        (data.cell as unknown as { _code?: string })._code = code;
      }
    },
    didDrawCell: (data) => {
      const code = (data.cell as unknown as { _code?: string })._code;
      if (code && data.section === "body" && data.column.index === 1) {
        doc.setFont("courier", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(...GRAY_SOFT);
        doc.text(code, data.cell.x + 2, data.cell.y + data.cell.height - 1.4);
      }
    },
    bodyStyles: { minCellHeight: 10 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fy = ((doc as any).lastAutoTable?.finalY ?? y) + 6;

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const totalTax = items.reduce((s, it) => s + it.quantity * it.unitPrice * ((it.taxRate || 0) / 100), 0);
  const total = subtotal + totalTax;

  const noteLines = notes ? doc.splitTextToSize(notes, (pageW - 2 * mx) * 0.55 - 8) : [];
  const blockH = Math.max(34, noteLines.length * 4 + 14) + 14;
  if (fy + blockH > pageH - 20) { doc.addPage(); fy = 20; }

  // Totales (der)
  const tw = 70;
  const tx = rightX - tw;
  let ty = fy;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const row = (label: string, value: string) => {
    doc.setTextColor(...GRAY);
    doc.text(label, tx, ty);
    doc.setTextColor(...INK);
    doc.text(value, rightX, ty, { align: "right" });
    ty += 5.5;
  };
  row("Subtotal", cop(subtotal));
  if (totalTax > 0) row("IVA", cop(totalTax));
  ty += 1;
  doc.setFillColor(...ACCENT_FILL);
  doc.roundedRect(tx - 3, ty - 4.5, tw + 3, 11, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ON_ACCENT);
  doc.text(totalLabel.toUpperCase(), tx, ty + 2.5);
  doc.setFontSize(13);
  doc.text(cop(total), rightX - 2, ty + 2.8, { align: "right" });
  ty += 12;

  // Notas (izq)
  if (notes) {
    const nw = (pageW - 2 * mx) * 0.55;
    doc.setFillColor(...ACCENT_SOFT);
    doc.roundedRect(mx, fy - 4.5, nw, noteLines.length * 4 + 10, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...ACCENT);
    doc.text("NOTAS", mx + 4, fy + 0.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(noteLines, mx + 4, fy + 5);
  }

  // Monto en letras (ancho completo, bajo el bloque)
  const wordsY = Math.max(ty, fy + (notes ? noteLines.length * 4 + 10 : 0)) + 4;
  doc.setDrawColor(...RULE);
  doc.line(mx, wordsY - 3, rightX, wordsY - 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_SOFT);
  doc.text("SON:", mx, wordsY + 1.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  doc.text(pesosEnLetras(total), mx + 9, wordsY + 1.5, { maxWidth: pageW - 2 * mx - 9 });

  // ── Pie en todas las páginas ──
  const pages = doc.getNumberOfPages();
  const generated = format(new Date(), "dd/MM/yyyy HH:mm", { locale: es });
  const contact = [business.name, business.phone ? `Tel. ${business.phone}` : null, business.city].filter(Boolean).join(" · ");
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...RULE);
    doc.line(mx, pageH - 15, rightX, pageH - 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...GRAY_SOFT);
    doc.text(footerNote ? `${footerNote}` : contact, mx, pageH - 10.5);
    if (footerNote) doc.text(contact, mx, pageH - 7);
    doc.text(`Generado ${generated}${pages > 1 ? ` · Página ${p} de ${pages}` : ""}`, rightX, pageH - 10.5, { align: "right" });
  }

  return doc;
}
