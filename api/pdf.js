// api/pdf.ts
// Runtime correcto para Vercel (Serverless Node): "nodejs"
export const config = { runtime: "nodejs" };

import type { VercelRequest, VercelResponse } from "@vercel/node";
import PDFDocument from "pdfkit";

/**
 * Body esperado:
 * {
 *   logoDataUrl?: string, // dataURL opcional (png/jpg)
 *   dias: number,
 *   items: Array<{
 *     qty: number,
 *     rol: string,
 *     turno: string,
 *     horasPersona: number,
 *     unitPrice: number,
 *     total: number,
 *     moneda: string
 *   }>,
 *   totals: { totalDia: number, totalSemana: number }
 * }
 */

function toNumber(n: any, fallback = 0) {
  const v = typeof n === "string" ? Number(n.replace(/[^\d.-]/g, "")) : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function money(n: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  // Asegura JSON aunque el framework no lo haya parseado
  let body: any = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== "object") body = {};

  const dias = toNumber(body.dias, 5);

  const items = Array.isArray(body.items) ? body.items : [];
  const cleanItems = items.map((l: any) => ({
    qty: toNumber(l?.qty),
    rol: String(l?.rol ?? ""),
    turno: String(l?.turno ?? ""),
    horasPersona: toNumber(l?.horasPersona),
    unitPrice: toNumber(l?.unitPrice),
    total: toNumber(l?.total),
    moneda: String(l?.moneda ?? "MXN"),
  }));

  const totals = body.totals ?? {};
  const totalDia = toNumber(totals.totalDia);
  const totalSemana = toNumber(totals.totalSemana);
  const moneda = cleanItems[0]?.moneda || "MXN";

  // PDF
  const doc = new PDFDocument({
    size: "LETTER",
    margin: 48,
    info: { Title: "Cotización de servicio de limpieza" },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="Cotizacion_CleanWay.pdf"');
  doc.pipe(res);

  const today = new Date();
  const fecha = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(today);

  // Logo
  let cursorY = doc.y;
  const logoDataUrl = body.logoDataUrl as string | undefined;
  if (logoDataUrl && /^data:image\/(png|jpe?g);base64,/.test(logoDataUrl)) {
    try {
      const base64 = logoDataUrl.split(",")[1];
      const buf = Buffer.from(base64, "base64");
      doc.image(buf, 48, cursorY, { width: 90 });
    } catch { /* sin logo si falla */ }
  }

  // Título + fecha / vigencia
  doc.fontSize(18).font("Helvetica-Bold")
    .text("Cotización de servicio de limpieza", 150, cursorY, { align: "left" });

  doc.fontSize(9).font("Helvetica")
    .text(`Fecha: ${fecha}`, 480, cursorY, { width: 120, align: "left" })
    .text(`Vigencia: 30 días`, 480, doc.y + 2, { width: 120, align: "left" });

  // Datos empresa
  doc.moveDown(1.2);
  doc.fontSize(9)
    .text("Carretera Saltillo-Monterrey km 5.5 #7290, Los Rodríguez", 48)
    .text("Saltillo Coahuila, México. C.P. 25200")
    .text("hola@cleanway.la", { link: "mailto:hola@cleanway.la" });

  doc.moveDown(0.6);
  doc.font("Helvetica-Bold")
    .text(`Días efectivos por semana: ${dias}`)
    .font("Helvetica");

  // Tabla
  doc.moveDown(0.8);

  const x = 48;
  const w = 515;
  const col = {
    qty: x,
    producto: x + 40,
    servicio: x + 160,
    hrs: x + 300,
    unit: x + 365,
    total: x + 445,
    moneda: x + 510,
  };

  const headerY = doc.y + 6;
  doc.rect(x, headerY - 4, w, 18).fill("#eef2f7").stroke("#c7d2e0");
  doc.fillColor("#000").font("Helvetica-Bold").fontSize(9)
    .text("Qty", col.qty, headerY, { width: 35 })
    .text("Producto", col.producto, headerY, { width: 110 })
    .text("Servicio", col.servicio, headerY, { width: 120 })
    .text("Hrs/persona", col.hrs, headerY, { width: 55, align: "right" })
    .text("U. Price", col.unit, headerY, { width: 70, align: "right" })
    .text("Total", col.total, headerY, { width: 60, align: "right" })
    .text("Moneda", col.moneda, headerY, { width: 40, align: "left" });

  let y = headerY + 20;
  doc.font("Helvetica").fontSize(9);

  for (const l of cleanItems) {
    const lineH = 16;
    doc.text(String(l.qty), col.qty, y, { width: 35 });
    doc.text(l.rol, col.producto, y, { width: 110 });
    doc.text(l.turno, col.servicio, y, { width: 120 });
    doc.text(l.horasPersona.toFixed(1), col.hrs, y, { width: 55, align: "right" });
    doc.text(money(l.unitPrice, moneda), col.unit, y, { width: 70, align: "right" });
    doc.text(money(l.total, moneda), col.total, y, { width: 60, align: "right" });
    doc.text(moneda, col.moneda, y, { width: 40, align: "left" });

    doc.moveTo(x, y + lineH - 3).lineTo(x + w, y + lineH - 3)
      .strokeColor("#e5e7eb").lineWidth(0.5).stroke();

    y += lineH;
    if (y > doc.page.height - 170) {
      doc.addPage();
      y = 72;
    }
  }

  // Totales (alineados a la derecha)
  y += 10;
  const rightBoxX = x + w - 220;
  const rowH = 16;

  doc.font("Helvetica-Bold")
    .text("Subtotal:", rightBoxX, y, { width: 100, align: "right" })
    .text(money(totalDia * dias, moneda), rightBoxX + 110, y, { width: 110, align: "right" });
  y += rowH;

  const iva = totalSemana * 0.16;
  doc.font("Helvetica")
    .text("IVA 16%:", rightBoxX, y, { width: 100, align: "right" })
    .text(money(iva, moneda), rightBoxX + 110, y, { width: 110, align: "right" });
  y += rowH;

  const totalConIVA = totalSemana + iva;
  doc.font("Helvetica-Bold")
    .text("Total:", rightBoxX, y, { width: 100, align: "right" })
    .text(money(totalConIVA, moneda), rightBoxX + 110, y, { width: 110, align: "right" });

  // Notas
  y += 30;
  doc.font("Helvetica-Bold").text("Notas y condiciones", x, y).moveDown(0.4);
  doc.font("Helvetica")
    .text("• Se incluye el transporte del personal.")
    .text("• Los insumos de limpieza no están incluidos salvo pacto en contrario.")
    .text("• La presente cotización corresponde a una semana de servicio según turnos indicados.")
    .text("• Vigencia: 30 días naturales.");

  doc.end();
}
