// api/pdf.js — CommonJS, buffer en memoria, headers estrictos y guardas de payload
'use strict';

const PDFDocument = require('pdfkit');

// Formateo con separador de miles
const fmtMXN = (n) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(Number.isFinite(n) ? n : 0);

// Log de errores inesperados (por si algo se sale del try/catch)
process.on('uncaughtException', (e) => console.error('[/api/pdf] uncaught', e));
process.on('unhandledRejection', (e) => console.error('[/api/pdf] unhandled', e));

module.exports = async function (req, res) {
  console.log('[/api/pdf] init', { method: req.method, ts: new Date().toISOString() });

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const items = Array.isArray(body.items) ? body.items : [];
    console.log('[/api/pdf] payload ok', { items: items.length });

    // 1) Crear PDF y acumular chunks
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks = [];
    let ended = false;

    doc.on('data', (c) => chunks.push(c));
    doc.on('error', (err) => {
      console.error('[/api/pdf] pdfkit-error', err);
    });
    doc.on('end', () => {
      ended = true;
      const pdf = Buffer.concat(chunks);

      // 2) Enviar binario con longitud fija
      try {
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="Cotizacion_CleanWay.pdf"',
          'Content-Length': String(pdf.length),
          'Cache-Control': 'no-store',
          'Content-Encoding': 'identity'
        });
        res.end(pdf);
        console.log('[/api/pdf] sent bytes', pdf.length);
      } catch (e) {
        console.error('[/api/pdf] writeHead/end error', e);
        if (!res.headersSent) {
          try { res.status(500).json({ error: 'send_failed' }); } catch {}
        }
      }
    });

    // 3) Construcción del PDF
    const startX = doc.page.margins.left;
    let y = doc.page.margins.top;

    // Logo opcional
    if (body?.logoDataUrl) {
      try {
        const base64 = String(body.logoDataUrl).split(',')[1];
        if (base64) {
          const buf = Buffer.from(base64, 'base64');
          doc.image(buf, startX, y, { width: 90 });
        }
      } catch (e) {
        console.warn('[/api/pdf] logo-parse-failed', e?.message || e);
      }
    }

    doc.fontSize(20).fillColor('#0f172a').text('Cotización de servicio de limpieza', startX + 110, y);
    y += 28;

    doc.fontSize(9).fillColor('#334155');
    doc.text('Carretera Saltillo-Monterrey km 5.5 #7290, Los Rodríguez', startX + 110, y);
    y += 12;
    doc.text('Saltillo Coahuila, México. C.P. 25200  •  hola@cleanway.la', startX + 110, y);
    y += 20;

    const rightX = doc.page.width - doc.page.margins.right - 180;
    const fecha = new Date();
    doc.fontSize(10).fillColor('#111').text('Fecha:', rightX, doc.page.margins.top);
    doc.text(fecha.toLocaleDateString('es-MX'), rightX + 65, doc.page.margins.top);
    doc.text('Vigencia:', rightX, doc.page.margins.top + 14);
    doc.text('30 días', rightX + 65, doc.page.margins.top + 14);
    doc.text('Moneda:', rightX, doc.page.margins.top + 28);
    doc.text(body?.totals?.moneda || 'MXN', rightX + 65, doc.page.margins.top + 28);

    y += 8;
    doc.moveTo(startX, y).lineTo(doc.page.width - doc.page.margins.right, y)
      .strokeColor('#e5e7eb').stroke();
    y += 10;

    // Si no hay items, devolvemos un PDF mínimo válido y salimos
    if (items.length === 0) {
      doc.fontSize(11).fillColor('#111').text('Detalle de servicios', startX, y);
      y += 14;
      doc.fontSize(9).fillColor('#334155')
        .text('No se proporcionaron partidas en esta solicitud.', startX, y);
      doc.end();
      console.log('[/api/pdf] doc.end() called (no items)');
      return;
    }

    // Tabla
    const cols = [
      { key: 'qty',    label: 'Qty',          width: 35,  align: 'left'  },
      { key: 'rol',    label: 'Producto',     width: 120, align: 'left'  },
      { key: 'turno',  label: 'Servicio',     width: 95,  align: 'left'  },
      { key: 'horas',  label: 'Hrs/persona',  width: 80,  align: 'right' },
      { key: 'unit',   label: 'U. Price',     width: 80,  align: 'right' },
      { key: 'total',  label: 'Total',        width: 90,  align: 'right' },
      { key: 'moneda', label: 'Moneda',       width: 55,  align: 'left'  }
    ];
    const tableWidth = cols.reduce((a, c) => a + c.width, 0);

    function headerRow() {
      doc.save();
      doc.rect(startX, y, tableWidth, 22).fill('#eef2ff').stroke('#c7d2fe');
      doc.fillColor('#111827').fontSize(10);
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
    function row(r, zebra) {
      pageBreak();
      doc.save();
      if (zebra) doc.rect(startX, y, tableWidth, 22).fill('#f8fafc').stroke('#e2e8f0');
      else       doc.rect(startX, y, tableWidth, 22).stroke('#e2e8f0');
      let x = startX + 8;
      doc.fillColor('#111').fontSize(10);

      for (const c of cols) {
        let val = '';
        if (c.key === 'horas')       val = ((r?.horasPersona ?? 0)).toFixed(1);
        else if (c.key === 'unit')   val = fmtMXN(r?.unitPrice ?? 0);
        else if (c.key === 'total')  val = fmtMXN(r?.total ?? 0);
        else if (c.key === 'moneda') val = r?.moneda || 'MXN';
        else if (c.key === 'qty')    val = String(r?.qty ?? 0);
        else if (c.key === 'rol')    val = r?.rol ?? '';
        else if (c.key === 'turno')  val = r?.turno ?? '';
        doc.text(val, x, y + 6, { width: c.width - 16, align: c.align });
        x += c.width;
      }

      doc.restore();
      y += 22;
    }

    headerRow();
    items.forEach((it, idx) => row(it, idx % 2 === 1));

    // Totales
    y += 12;
    const right = startX + tableWidth;
    const lineH = 16;
    const subtotal = items.reduce((a, b) => a + (b?.total || 0), 0);
    const iva = subtotal * 0.16;
    const granTotal = subtotal + iva;

    doc.fontSize(10).fillColor('#334155');
    function totalRow(label, value) {
      doc.text(label, right - 200, y, { width: 110, align: 'right' });
      doc.fillColor('#111').text(value, right - 85, y, { width: 85, align: 'right' });
      y += lineH;
      doc.fillColor('#334155');
    }
    totalRow('Subtotal:', fmtMXN(subtotal));
    totalRow('IVA 16%:', fmtMXN(iva));
    doc.moveTo(right - 200, y).lineTo(right, y).strokeColor('#cbd5e1').stroke();
    y += 6;
    doc.fontSize(11).fillColor('#111');
    totalRow('Total:', fmtMXN(granTotal));

    // Notas
    y += 8;
    doc.fontSize(10).fillColor('#111').text('Notas y condiciones', startX, y);
    y += 12;
    doc.fontSize(9).fillColor('#334155').text(
      [
        '• Se incluye el transporte del personal.',
        '• Los insumos de limpieza no están incluidos salvo pacto en contrario.',
        '• La presente cotización corresponde a una semana de servicio según turnos indicados.',
        '• Vigencia: 30 días naturales.'
      ].join('\n'),
      startX,
      y
    );

    // 4) Cerrar PDF (dispara 'end' y ahí respondemos)
    doc.end();
    console.log('[/api/pdf] doc.end() called');
  } catch (e) {
    console.error('[/api/pdf] fatal', e);
    if (!res.headersSent) {
      res.status(500).json({ error: 'pdf_error', message: e?.message || String(e) });
    } else {
      try { res.end(); } catch {}
    }
  }
};
