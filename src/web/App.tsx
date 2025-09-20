// src/web/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import catalogsRaw from "../../data/catalogs.cleanway.json";
import { cotizarCleanWay } from "../engine_cleanway";
import type {
  CleanWayInput,
  ShiftInput,
  Resultado,
  LineaRol
} from "../types";

const fmtMXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2
});

const defaultShifts: ShiftInput[] = [
  {
    enabled: true,
    label: "Primer",
    horaEntrada: "06:00",
    horaSalida: "14:00",
    auxiliares: 0,
    supervisores: 0
  },
  {
    enabled: false,
    label: "Segundo",
    horaEntrada: "14:00",
    horaSalida: "22:00",
    auxiliares: 0,
    supervisores: 0
  },
  {
    enabled: false,
    label: "Tercer",
    horaEntrada: "22:00",
    horaSalida: "06:00",
    auxiliares: 0,
    supervisores: 0
  },
  {
    enabled: false,
    label: "Personalizado",
    horaEntrada: "06:00",
    horaSalida: "14:00",
    auxiliares: 0,
    supervisores: 0
  }
];

// helper tipado con el union de CleanWayInput["dias"]
function diasToLabel(d: CleanWayInput["dias"]) {
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
  // usa el union, no string
  const [dias, setDias] = useState<CleanWayInput["dias"]>("L-S");
  const [diasPers, setDiasPers] = useState<string[]>(["L", "M", "X", "J", "V"]);
  const [insumosQuokka, setInsumosQuokka] = useState(true);
  const [shifts, setShifts] = useState<ShiftInput[]>(defaultShifts);

  const catalogs = catalogsRaw as unknown as Record<string, unknown>;

  // precargar logo para PDF
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
      } catch {
        // silencio elegante
      }
    })();
    return () => {
      cancel = true;
    };
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
    setDiasPers(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
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
      <div className="header">
        <img src="/logo-cleanway.png" alt="Clean Way" />
        <div>
          <h1>Cotizador Clean Way</h1>
          <div className="subtle">Parámetros de cotización</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginTop: 16
        }}
      >
        <label>
          Días de semana
          <select
            value={diasToLabel(dias)}
            onChange={e =>
              setDias(
                e.target.value === "Personalizado"
                  ? "custom"
                  : (e.target.value as CleanWayInput["dias"])
              )
            }
            style={{ width: "100%" }}
          >
            <option value="L-V">L-V</option>
            <option value="L-S">L-S</option>
            <option value="L-D">L-D</option>
            <option value="L,M,X,J,V">L,M,X,J,V</option>
            <option value="Personalizado">Personalizado</option>
          </select>
        </label>

        <label>
          ¿Quokka provee insumos?
          <select
            value={insumosQuokka ? "si" : "no"}
            onChange={e => setInsumosQuokka(e.target.value === "si")}
            style={{ width: "100%" }}
          >
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </label>

        <div style={{ display: dias === "custom" ? "block" : "none" }}>
          <div className="subtle">Selecciona días</div>
          {["L", "M", "X", "J", "V", "S", "D"].map((d: string) => (
            <label key={d} style={{ marginRight: 8 }}>
              <input
                type="checkbox"
                checked={diasPers.includes(d)}
                onChange={() => toggleDia(d)}
              />{" "}
              {d}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Turnos y dotación por turno</h3>
        {shifts.map((s, i) => (
          <div key={i} className="card" style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "80px 160px 160px 160px 160px 160px",
                gap: 12,
                alignItems: "end"
              }}
            >
              <label>
                Activo
                <select
                  value={s.enabled ? "si" : "no"}
                  onChange={e => updateShift(i, { enabled: e.target.value === "si" })}
                  style={{ width: "100%" }}
                >
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label>
                Turno
                <select
                  value={s.label}
                  onChange={e => updateShift(i, { label: e.target.value as ShiftInput["label"] })}
                  style={{ width: "100%" }}
                >
                  <option value="Primer">Primer</option>
                  <option value="Segundo">Segundo</option>
                  <option value="Tercer">Tercer</option>
                  <option value="Personalizado">Personalizado</option>
                </select>
              </label>
              <label>
                Entrada
                <input
                  type="time"
                  value={s.horaEntrada}
                  onChange={e => updateShift(i, { horaEntrada: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                Salida
                <input
                  type="time"
                  value={s.horaSalida}
                  onChange={e => updateShift(i, { horaSalida: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                Auxiliares
                <select
                  value={s.auxiliares}
                  onChange={e =>
                    updateShift(i, { auxiliares: Number(e.target.value) })
                  }
                  style={{ width: "100%" }}
                >
                  {range(50).map(n => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Supervisores
                <select
                  value={s.supervisores}
                  onChange={e =>
                    updateShift(i, { supervisores: Number(e.target.value) })
                  }
                  style={{ width: "100%" }}
                >
                  {range(50).map(n => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>

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
                <td>
                  <span className="chip">{l.turno}</span>
                </td>
                <td className="num">{l.horasPorPersona.toFixed(1)}</td>
                <td className="num">{fmtMXN.format(l.precioUnitarioHora)}</td>
                <td className="num">{fmtMXN.format(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12, fontWeight: 600, textAlign: "right" }}>
          Total por día: {fmtMXN.format(res.totalDia)} MXN &nbsp; | &nbsp; Total semanal:{" "}
          {fmtMXN.format(res.totalSemana)} MXN
        </div>
      </div>

      <div style={{ marginTop: 16, textAlign: "right" }}>
        <button className="btn" disabled={generating} onClick={generarPDFServidor}>
          {generating ? "Generando..." : "Generar PDF (servidor)"}
        </button>
      </div>
    </div>
  );
}
