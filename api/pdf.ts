import type { VercelRequest, VercelResponse } from "@vercel/node";
import PDFDocument from "pdfkit";

type PdfItem = {
  qty: number;
  rol: string;
  turno: string;
  horasPersona: number;
  unitPrice: number;
  total: number;
  moneda?: string;
};

type Payload = {
  logoDataUrl?: string;
  header?: {
    dias?: number;
    // si después quieres meter cliente/dirección/folio/validez, los añadimos aquí
  };
  items: PdfItem[];
  totals: { totalDia: number; totalSemana: number; moneda?: string };
};

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as Payload;

    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => {
      const pdf = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="Cotizacion_CleanWay.pdf"');
      res.status(200).send(pdf);
    });

    const startX = doc.page.margins.left;
    let y = doc.page.margins.top;

    // Header
    if (body.logoDataUrl) {
      try {
        const b64 = body.logoDataUrl.split(",")[1];
        const buf = Buffer.from(b64, "base64");
        doc.image(buf, startX, y, { width: 90 });
      } catch {}
    }
    doc.fontSize(20).fillColor("#0f172a").text("Cotización de servicio de limpieza", startX + 110, y);
    y += 28;

    doc.fontSize(9).fillColor("#334155");
    doc.text("Carretera Saltillo-Monterrey km 5.5 #7290, Los Rodríguez", startX + 110, y);
    y += 12;
    doc.text("Saltillo Coahuila, México. C.P. 25200  •  hola@cleanway.la", startX + 110, y);
    y += 20;

    // Meta a la derecha
    const rightX = doc.page.width - doc.page.margins.right - 180;
    const fecha = new Date();
    doc.fontSize(10).fillColor("#111").text("Fecha:", rightX, doc.page.margins.top);
    doc.text(fecha.toLocaleDateString("es-MX"), rightX + 65, doc.page.margins.top);
    doc.text("Vigencia:", rightX, doc.page.margins.top + 14);
    doc.text("30 días", rightX + 65, doc.page.margins.top + 14);
    doc.text("Moneda:", rightX, doc.page.margins.top + 28);
    doc.text(body.totals?.moneda || "MXN", rightX + 65, doc.page.margins.top + 28);

    // Bill to (placeholder por ahora)
    y += 8;
    doc.moveTo(startX, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor("#e5e7eb").stroke();
    y += 10;
    doc.fontSize(11).fillColor("#111").text("Datos del cliente", startX, y);
    y += 14;
    doc.fontSize(9).fillColor("#334155")
      .text("Cliente:", startX, y)
      .text("Dirección:", startX, y + 12)
      .text("RFC:", startX, y + 24);
    y += 40;

    // Tabla
    const cols = [
      { key: "qty", label: "Qty", width: 35, align: "left" as const },
      { key: "rol", label: "Producto", width: 120, align: "left" as const },
      { key: "turno", label: "Servicio", width: 95, align: "left" as const },
      { key: "horas", label: "Hrs/persona", width: 80, align: "right" as const },
      { key: "unit", label: "U. Price", width: 80, align: "right" as const },
      { key: "total", label: "Total", width: 90, align: "right" as const },
      { key: "moneda", label: "Moneda", width: 55, align: "left" as const }
    ];
    const tableWidth = cols.reduce((a, c) => a + c.width, 0);

    function headerRow() {
      doc.save();
      doc.rect(startX, y, tableWidth, 22).fill("#eef2ff").stroke("#c7d2fe");
      doc.fillColor("#111827").fontSize(10);
      let x = startX + 8;
      for (const c of cols) {
        doc.text(c.label, x, y + 6, { width: c.width - 16, align: c.align });
        x += c.width;
      }
      doc.restore();
      y += 22;
    }
    function pageBreak(rowH = 22) {
      const limit = doc.page.height - doc.page.margins.bottom - 140;
      if (y + rowH > limit) {
        doc.addPage();
        y = doc.page.margins.top;
        headerRow();
      }
    }
    function row(r: PdfItem, zebra: boolean) {
      pageBreak();
      doc.save();
      if (zebra) doc.rect(startX, y, tableWidth, 22).fill("#f8fafc").stroke("#e2e8f0");
      else       doc.rect(startX, y, tableWidth, 22).stroke("#e2e8f0");
      let x = startX + 8;
      doc.fillColor("#111").fontSize(10);
      for (const c of cols) {
        let val = "";
        if (c.key === "horas")  val = (r.horasPersona ?? 0).toFixed(1);
        else if (c.key === "unit")  val = fmtMXN(r.unitPrice ?? 0);
        else if (c.key === "total") val = fmtMXN(r.total ?? 0);
        else if (c.key === "moneda") val = r.moneda || "MXN";
        else if (c.key === "qty")   val = String(r.qty ?? 0);
        else if (c.key === "rol")   val = r.rol ?? "";
        else if (c.key === "turno") val = r.turno ?? "";
        doc.text(val, x, y + 6, { width: c.width - 16, align: c.align });
        x += c.width;
      }
      doc.restore();
      y += 22;
    }

    headerRow();
    (body.items || []).forEach((it, idx) => row(it, idx % 2 === 1));

    // Totales a la derecha
    y += 12;
    const right = startX + tableWidth;
    const lineH = 16;
    const subtotal = (body.items || []).reduce((a, b) => a + (b.total || 0), 0);
    const iva = subtotal * 0.16; // si usas otra tasa, la hacemos param luego
    const granTotal = subtotal + iva;

    doc.fontSize(10).fillColor("#334155");
    function totalRow(label: string, value: string) {
      doc.text(label, right - 200, y, { width: 110, align: "right" });
      doc.font("#111").text(value, right - 85, y, { width: 85, align: "right" });
      y += lineH;
      doc.fillColor("#334155");
    }
    totalRow("Subtotal:", fmtMXN(subtotal));
    totalRow("IVA 16%:", fmtMXN(iva));
    doc.moveTo(right - 200, y).lineTo(right, y).strokeColor("#cbd5e1").stroke();
    y += 6;
    doc.fontSize(11).fillColor("#111");
    totalRow("Total:", fmtMXN(granTotal));

    // Notas
    y += 8;
    doc.fontSize(10).fillColor("#111").text("Notas y condiciones", startX, y);
    y += 12;
    doc.fontSize(9).fillColor("#334155").text(
      [
        "• Se incluye el transporte del personal.",
        "• Los insumos de limpieza no están incluidos salvo pacto en contrario.",
        "• La presente cotización corresponde a una semana de servicio según turnos indicados.",
        "• Vigencia: 30 días naturales."
      ].join("\n"),
      startX,
      y
    );

    doc.end();
  } catch (e: any) {
    res.status(500).json({ error: "pdf_error", message: e?.message || String(e) });
  }
}
