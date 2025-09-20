// src/web/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import catalogsRaw from "../../data/catalogs.cleanway.json";
import { cotizarCleanWay } from "../engine_cleanway";     // ← ruta corregida
import type { CleanWayInput, ShiftInput, Resultado, LineaRol } from "../types";

const fmtMXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2
});

const defaultShifts: ShiftInput[] = [
  { enabled: true,  label: "Primer",        horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Segundo",       horaEntrada: "14:00", horaSalida: "22:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Tercer",        horaEntrada: "22:00", horaSalida: "06:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Personalizado", horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 0, supervisores: 0 }
];

function diasToLabel(d: string) {
  if (d === "L-V") return "L-V";
  if (d === "L-S") return "L-S";
  if (d === "L-D") return "L-D";
  if (d === "L,M,X,J,V") return "L,M,X,J,V";
  return "Personalizado";
}

function range(n: number) {
  return Array.from({ length: n + 1 }, (_, i) => i);
}

export default function App() {
  const [dias, setDias] = useState<string>("L-S");
  const [diasPers, setDiasPers] = useState<string[]>(["L", "M", "X", "J", "V"]);
  const [insumosQuokka, setInsumosQuokka] = useState(true);
  const [shifts, setShifts] = useState<ShiftInput[]>(defaultShifts);

  const catalogs = catalogsRaw as unknown as Record<string, unknown>;

  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch("/logo-cleanway.png");
        if (!r.ok) return;
        const b = await r.blob();
        const dataUrl = await new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result as string);
          fr.onerror = () => rej(new Error("reader"));
          fr.readAsDataURL(b);
        });
        if (!cancel) setLogoDataUrl(dataUrl);
      } catch {}
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (dias === "L-V") setDiasPers(["L", "M", "X", "J", "V"]);
  }, [dias]);

  const input: CleanWayInput = useMemo(
    () => ({
      dias,
      diasPersonalizados:
        dias === "custom"
          ? diasPers
          : dias === "L,M,X,J,V"
          ? ["L", "M", "X", "J", "V"]
          : undefined,
      insumosProveeQuokka: insumosQuokka,
      shifts,
      m2: undefined
    }),
    [dias, diasPers, insumosQuokka, shifts]
  );

  const res: Resultado = useMemo(() => cotizarCleanWay(catalogs, input), [input]);

  function updateShift(i: number, patch: Partial<ShiftInput>) {
    setShifts(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function toggleDia(d: string) {
    setDias("custom");
    setDiasPers(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]));
  }

  const [generating, setGenerating] = useState(false);
  async function generarPDFServidor() {
    setGenerating(true);
    try {
      const payload = {
        logoDataUrl: logoDataUrl || undefined,
        header: { dias: res.diasEfectivosSemana },
        items: res.lineas.map((l: LineaRol) => ({
          Cantidad: l.Cantidad,
          rol: l.rol,
          turno: l.turno,
          horasPersona: l.horasPorPersona,
          "Precio/hora": l.precioUnitarioHora,
          total: l.total,
          moneda: "MXN"
        })),
        totals: {
          totalDia: res.totalDia,
          totalSemana: res.totalSemana,
          moneda: "MXN"
        }
      };

      const resp = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Cotizacion_CleanWay.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`No se pudo generar el PDF en servidor: ${e?.message || e}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="container">
      {/* ... tu encabezado y controles ... */}

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Desglose por línea</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Cantidad</th>
              <th>Rol</th>
              <th>Turno</th>
              <th className="num">Hrs/persona</th>
              <th className="num">Precio/hora</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {res.lineas.map((l: LineaRol, idx: number) => (
              <tr key={idx}>
                <td>{l.Cantidad}</td>
                <td>{l.rol}</td>
                <td><span className="chip">{l.turno}</span></td>
                <td className="num">{l.horasPorPersona.toFixed(1)}</td>
                <td className="num">{fmtMXN.format(l.precioUnitarioHora)}</td>
                <td className="num">{fmtMXN.format(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, textAlign: "right" }}>
        <button className="btn" disabled={generating} onClick={generarPDFServidor}>
          {generating ? "Generando..." : "Generar PDF (servidor)"}
        </button>
      </div>
    </div>
  );
}
