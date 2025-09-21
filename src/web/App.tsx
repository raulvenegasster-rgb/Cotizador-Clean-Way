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
  { enabled: true,  label: "Primer",        horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Segundo",       horaEntrada: "14:00", horaSalida: "22:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Tercer",        horaEntrada: "22:00", horaSalida: "06:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Personalizado", horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 0, supervisores: 0 }
];

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
  const [dias, setDias] = useState<CleanWayInput["dias"]>("L-S");
  const [diasPers, setDiasPers] = useState<string[]>(["L", "M", "X", "J", "V"]);
  const [insumosQuokka, setInsumosQuokka] = useState(true);
  const [shifts, setShifts] = useState<ShiftInput[]>(defaultShifts);

  const catalogs = catalogsRaw as unknown as Record<string, unknown>;

  // si algún día quieres reusar el logo, ya queda precargado
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

  // estilo inline para el “radio” único circular
  const radioCircleStyle: React.CSSProperties = {
    width: 20,
    height: 20,
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    borderRadius: "50%",
    border: "2px solid var(--line)",
    background: "transparent",
    display: "inline-block",
    verticalAlign: "middle",
    cursor: "pointer",
    outline: "none",
    transition: "box-shadow .15s ease, border-color .15s ease, background .15s ease"
  };

  const radioCircleCheckedStyle: React.CSSProperties = {
    ...radioCircleStyle,
    borderColor: "var(--brand)",
    background: "var(--brand)",
    boxShadow: "inset 0 0 0 5px var(--panel)"
  };

  return (
    <div className="container">
      <div className="header">
        <img src="/logo-cleanway.png" alt="Clean Way" />
        <div>
          <h1>Cotizador Clean Way</h1>
          <div className="subtle">Parámetros de cotización</div>
        </div>
      </div>

      {/* Controles superiores con el grid estilizado (definido en index.html) */}
      <div className="grid-ctrls">
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
          >
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Turnos y dotación por turno</h3>
        {shifts.map((s, i) => (
          <div key={i} className="card" style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 160px 160px 160px 160px 160px",
                gap: 12,
                alignItems: "end"
              }}
            >
              {/* Activo: único “radio” circular seleccionable */}
              <div>
                <label style={{ marginBottom: 6, display: "block" }}>Activo</label>
                <input
                  type="checkbox"
                  aria-label={`Activar turno ${i + 1}`}
                  checked={s.enabled}
                  onChange={() => updateShift(i, { enabled: !s.enabled })}
                  style={s.enabled ? radioCircleCheckedStyle : radioCircleStyle}
                  onFocus={e => {
                    e.currentTarget.style.boxShadow = s.enabled
                      ? "inset 0 0 0 5px var(--panel), 0 0 0 3px rgba(14,165,233,.35)"
                      : "0 0 0 3px rgba(14,165,233,.35)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.boxShadow = s.enabled
                      ? "inset 0 0 0 5px var(--panel)"
                      : "none";
                  }}
                />
              </div>

              <label>
                Turno
                <select
                  value={s.label}
                  onChange={e =>
                    updateShift(i, { label: e.target.value as ShiftInput["label"] })
                  }
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
                />
              </label>

              <label>
                Salida
                <input
                  type="time"
                  value={s.horaSalida}
                  onChange={e => updateShift(i, { horaSalida: e.target.value })}
                />
              </label>

              <label>
                Auxiliares
                <select
                  value={s.auxiliares}
                  onChange={e => updateShift(i, { auxiliares: Number(e.target.value) })}
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
                  onChange={e => updateShift(i, { supervisores: Number(e.target.value) })}
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

        <div className="totals">
          <span>Total por día: {fmtMXN.format(res.totalDia)} MXN</span>
          <span>Total semanal: {fmtMXN.format(res.totalSemana)} MXN</span>
        </div>
      </div>
    </div>
  );
}
