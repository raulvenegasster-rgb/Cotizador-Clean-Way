// Estado para el spinner del botón
const [generating, setGenerating] = useState(false);

/**
 * Genera el PDF en el servidor (Vercel) y dispara la descarga.
 * Reemplaza COMPLETO tu generarPDFServidor() por este.
 */
async function generarPDFServidor() {
  try {
    setGenerating(true);

    // 1) Sanitizar y construir el payload
    //    Asumo que ya tienes "res" con los cálculos (res.lineas, res.totalDia, etc.)
    if (!res || !Array.isArray(res.lineas)) {
      console.error('[PDF] res.lineas no existe, payload vacío');
      alert('No hay datos para generar el PDF.');
      return;
    }

    const items = res.lineas
      .filter((l: any) => (l?.qty ?? l?.cantidad ?? 0) > 0) // por si tienes 0s
      .map((l: any) => ({
        qty: Number(l.qty ?? l.cantidad ?? 0),
        rol: String(l.rol ?? ''),
        turno: String(l.turno ?? ''),
        horasPersona: Number(l.horasPorPersona ?? 0),
        unitPrice: Number(l.precioUnitarioHora ?? 0),
        total: Number(l.total ?? 0),
        moneda: 'MXN'
      }));

    const payload = {
      // si tienes el logo como dataURL úsalo; si no, omítelo y el backend lo ignora
      logoDataUrl: logoDataUrl || undefined,
      header: {
        dias: Number(res.diasEfectivosSemana ?? 0)
      },
      items,
      totals: {
        totalDia: Number(res.totalDia ?? 0),
        totalSemana: Number(res.totalSemana ?? 0),
        moneda: 'MXN'
      }
    };

    // 2) Validación básica para no mandar basura
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      console.warn('[PDF] items está vacío; no se enviará');
      alert('Agrega al menos una línea con cantidad > 0 para generar el PDF.');
      return;
    }

    // 3) Llamada al API con JSON bien formado
    console.log('[PDF] POST /api/pdf payload', payload); // visible en DevTools Network > Request Payload
    const resp = await fetch('/api/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json' // OBLIGATORIO
      },
      body: JSON.stringify(payload)        // OBLIGATORIO
    });

    // 4) Manejo de errores HTTP
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error('[PDF] /api/pdf fallo', resp.status, txt);
      alert(`No se pudo generar el PDF en servidor: ${resp.status}`);
      return;
    }

    // 5) Descargar el PDF
    const blob = await resp.blob();
    if (!blob || blob.size === 0) {
      console.error('[PDF] blob vacío recibido');
      alert('El PDF regresó vacío. Revisa que las líneas tengan totales.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Cotizacion_CleanWay.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[PDF] excepcion', err);
    alert('Error al generar el PDF en servidor.');
  } finally {
    setGenerating(false);
  }
}
