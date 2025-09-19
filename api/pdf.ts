import type { VercelRequest, VercelResponse } from "@vercel/node";
import PDFDocument from "pdfkit";

type PdfPayload = {
  logoDataUrl?: string;
  header: {
    title: string;
    dias: number;
    politicas: { margenPct: number; overheadPct: number; insumosPct: number };
  };
  items: Array<{
    qty: number;
    rol: string;
    turno: string;
    horasPersona: number;
    unitPrice: number;
    total: number;
    moneda?: string;
  }>;
  totals: { totalDia: number; totalSemana: number; moneda?: string };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as PdfPayload;

    const doc = new PDFDocument({ size: "A4", margin: 40 });
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

    // Logo (opcional)
    if (body.logoDataUrl) {
      try {
        const base64 = body.logoDataUrl.split(",")[1];
        const buf = Buffer.from(base64, "base64");
        doc.image(buf, startX, y, { width: 120 });
      } catch { /* sin logo no se rompe */ }
    }

    const titleX = body.logoDataUrl ? startX + 130 : startX;
    doc.fontSize(18).fillColor("#111").text(body.header?.title || "Cotizador Clean Way", titleX, y);
    y += 18;
    doc.fontSize(10).fillColor("#555").text(`Días/semana: ${body.header?.dias ?? "-"}`, titleX, y);
    y += 10;
    const pol = body.header?.politicas || { margenPct: 0, overheadPct: 0, insumosPct: 0.085 };
    doc.fillColor("#111").fontSize(9).text(
      `Políticas: Margen ${Math.round((pol.margenPct ?? 0) * 100)}% | Overhead ${Math.round((pol.overheadPct ?? 0) * 100)}% | Insumos ${(((pol.insumosPct ?? 0.085) * 100).toFixed(1))}%`,
      startX,
      y + 8
    );

    // Tabla
    y += 34;
    const cols = [
      { key: "qty",    label: "Qty",         width: 40,  align: "left"  as const },
      { key: "rol",    label: "Producto",    width: 140, align: "left"  as const },
      { key: "turno",  label: "Servicio",    width: 100, align: "left"  as const },
      { key: "horas",  label: "Hrs/persona", width: 80,  align: "right" as const },
      { key: "unit",   label: "U. Price",    width: 80,  align: "right" as const },
      { key: "total",  label: "Total",       width: 80,  align: "right" as const },
      { key: "moneda", label: "Moneda",      width: 60,  align: "left"  as const }
    ];
    const tableWidth = cols.reduce((a, c) => a + c.width, 0);

    function headerRow() {
      doc.save();
      doc.rect(startX, y, tableWidth, 22).fill("#f3f4f6").stroke("#e5e7eb");
      doc.fillColor("#111").fontSize(10);
      let x = startX + 8;
      for (const c of cols) {
        doc.text(c.label, x, y + 6, { width: c.width - 16, align: c.align });
        x += c.width;
      }
      doc.restore();
      y += 22;
    }
    function pageBreak(rowH = 22) {
      const limit = doc.page.height - doc.page.margins.bottom;
      if (y + rowH > limit) {
        doc.addPage();
        y = doc.page.margins.top;
        headerRow();
      }
    }
    function row(r: any, zebra: boolean) {
      pageBreak();
      doc.save();
      if (zebra) doc.rect(startX, y, tableWidth, 22).fill("#fafafa").stroke("#e5e7eb");
      else       doc.rect(startX, y, tableWidth, 22).stroke("#e5e7eb");
      let x = startX + 8;
      doc.fillColor("#111").fontSize(10);
      for (const c of cols) {
        let val = "";
        if (c.key === "horas")  val = (r.horasPersona ?? 0).toFixed(1);
        else if (c.key === "unit")  val = `$ ${Number(r.unitPrice ?? 0).toFixed(2)}`;
        else if (c.key === "total") val = `$ ${Number(r.total ?? 0).toFixed(2)}`;
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
    (body.items || []).forEach((it, i) => row(it, i % 2 === 1));

    // Totales
    y += 12;
    const moneda = body.totals?.moneda || "MXN";
    doc.fontSize(11).text(`Total por día: $ ${Number(body.totals?.totalDia ?? 0).toFixed(2)} ${moneda}`, startX, y);
    y += 16;
    doc.fontSize(11).text(`Total semanal: $ ${Number(body.totals?.totalSemana ?? 0).toFixed(2)} ${moneda}`, startX, y);

    doc.end();
  } catch (e: any) {
    res.status(500).json({ error: "pdf_error", message: e?.message || String(e) });
  }
}
