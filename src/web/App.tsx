// src/web/App.tsx
import React, { useMemo, useState } from "react";

/** Utilidades */
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    isFinite(n) ? n : 0
  );

const parseTime = (hhmm: string) => {
  // hh:mm (24h)
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return (h % 24) + (m || 0) / 60;
};

const diffHours = (start: string, end: string) => {
  // soporta cruce nocturno
  const s = parseTime(start);
  let e = parseTime(end);
  if (e <= s) e += 24;
  return e - s;
};

/** Precios de ejemplo (ajústalos a tu tabla real) */
const PRICE_H_AUX = 129.52;
const PRICE_H_SUP = 175.66;

/** Tipos */
type TurnoKey = "primer" | "segundo" | "tercer" | "custom";

interface Linea {
  qty: number;
  rol: "Auxiliar" | "Supervisor";
  turno: "Primer" | "Segundo" | "Tercer" | "Personalizado";
  horasPorPersona: number;
  precioUnitarioHora: number;
  total: number;
  moneda: "MXN";
}

export default function App() {
  /** Parámetros de cabecera */
  const [dias, setDias] = useState<"L-V" | "L-S" | "L-D" | "LMXJV">("L-S");
  const diasEfectivosSemana = useMemo(() => {
    switch (dias) {
      case "L-V":
        return 5;
      case "L-S":
        return 6;
      case "L-D":
        return 7;
      case "LMXJV":
        return 5;
      default:
        return 6;
    }
  }, [dias]);

  /** Logo opcional (en DataURL) */
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  /** Turnos */
  const [turnosActivos, setTurnosActivos] = useState<Record<TurnoKey, boolean>>({
    primer: true,
    segundo: true,
    tercer: true,
    custom: false,
  });

  // horarios (24h HH:mm)
  const [t1, setT1] = useState({ in: "06:00", out: "14:00" });
  const [t2, setT2] = useState({ in: "14:00", out: "22:00" });
  const [t3, setT3] = useState({ in: "22:00", out: "06:00" });
  const [tc, setTc] = useState({ in: "06:00", out: "14:00" });

  /** Dotación por turno (selects grandes) */
  const [aux, setAux] = useState({ t1: 6, t2: 6, t3: 6, tc: 0 });
  const [sup, setSup] = useState({ t1: 1, t2: 1, t3: 1, tc: 0 });

  /** Insumos: si Quokka provee, margen 8.5% sobre total final */
  const [quokkaInsumos, setQuokkaInsumos] = useState<"SI" | "NO">("SI");

  /** Construcción de líneas */
  const lineas: Linea[] = useMemo(() => {
    const mk = (
      on: boolean,
      inout: { in: string; out: string },
      qtyAux: number,
      qtySup: number,
      label: Linea["turno"]
    ): Linea[] => {
      if (!on) return [];
      const horas = diffHours(inout.in, inout.out);
      const l: Linea[] = [];
      if (qtyAux > 0) {
        l.push({
          qty: qtyAux,
          rol: "Auxiliar",
          turno: label,
          horasPorPersona: horas * diasEfectivosSemana,
          precioUnitarioHora: PRICE_H_AUX,
          total: qtyAux * horas * diasEfectivosSemana * PRICE_H_AUX,
          moneda: "MXN",
        });
      }
      if (qtySup > 0) {
        l.push({
          qty: qtySup,
          rol: "Supervisor",
          turno: label,
          horasPorPersona: horas * diasEfectivosSemana,
          precioUnitarioHora: PRICE_H_SUP,
          total: qtySup * horas * diasEfectivosSemana * PRICE_H_SUP,
          moneda: "MXN",
        });
      }
      return l;
    };

    return [
      ...mk(turnosActivos.primer, t1, aux.t1, sup.t1, "Primer"),
      ...mk(turnosActivos.segundo, t2, aux.t2, sup.t2, "Segundo"),
      ...mk(turnosActivos.tercer, t3, aux.t3, sup.t3, "Tercer"),
      ...mk(turnosActivos.custom, tc, aux.tc, sup.tc, "Personalizado"),
    ];
  }, [turnosActivos, t1, t2, t3, tc, aux, sup, diasEfectivosSemana]);

  const totalSemana = useMemo(
    () => lineas.reduce((acc, l) => acc + l.total, 0),
    [lineas]
  );

  const totalDia = useMemo(() => {
    // divide entre días efectivos
    return diasEfectivosSemana > 0 ? totalSemana / diasEfectivosSemana : 0;
  }, [totalSemana, diasEfectivosSemana]);

  const totalConInsumos = useMemo(() => {
    if (quokkaInsumos === "SI") {
      return totalSemana * 1.085;
    }
    return totalSemana;
  }, [totalSemana, quokkaInsumos]);

  /** PDF servidor */
  const [generating, setGenerating] = useState(false);

  async function generarPDFServidor() {
    try {
      setGenerating(true);

      if (lineas.length === 0) {
        alert("Agrega al menos una línea con cantidad > 0 para generar el PDF.");
        return;
      }

      const payload = {
        logoDataUrl: logoDataUrl || undefined,
        header: {
          // Título lo fija el backend a "Cotización de servicio de limpieza"
          dias: diasEfectivosSemana,
        },
        items: lineas.map((l) => ({
          qty: l.qty,
          rol: l.rol,
          turno: l.turno,
          horasPersona: l.horasPorPersona,
          unitPrice: l.precioUnitarioHora,
          total: l.total,
          moneda: l.moneda,
        })),
        totals: {
          totalDia,
          totalSemana: totalConInsumos,
          moneda: "MXN",
        },
      };

      const resp = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("[/api/pdf] fallo", resp.status, txt);
        alert(`No se pudo generar el PDF en servidor: ${resp.status}`);
        return;
      }

      const blob = await resp.blob();
      if (!blob || blob.size === 0) {
        alert("El PDF regresó vacío.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Cotizacion_CleanWay.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PDF error", e);
      alert("Error al generar el PDF.");
    } finally {
      setGenerating(false);
    }
  }

  /** UI helpers */
  const NumberSelect: React.FC<{
    value: number;
    onChange: (v: number) => void;
    max?: number;
  }> = ({ value, onChange, max = 30 }) => {
    const options = Array.from({ length: max + 1 }, (_, i) => i);
    return (
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{ padding: 8, fontSize: 16, width: 90 }}
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    );
  };

  const TimeInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
  }> = ({ value, onChange }) => (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: 8, fontSize: 16 }}
    />
  );

  return (
    <div style={{ maxWidth: 1100, margin: "30px auto", padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 80,
            height: 80,
            background: "#eee",
            borderRadius: 8,
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
          }}
        >
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="logo" style={{ maxWidth: "100%" }} />
          ) : (
            <small>Logo</small>
          )}
        </div>
        <div>
          <h2 style={{ margin: 0 }}>Cotizador Clean Way</h2>
          <div style={{ color: "#666" }}>Parámetros de cotización</div>
        </div>
      </div>

      <hr style={{ margin: "20px 0" }} />

      {/* Parámetros */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Días</label>
          <select
            value={dias}
            onChange={(e) => setDias(e.target.value as any)}
            style={{ padding: 8, fontSize: 16, width: "100%" }}
          >
            <option value="L-V">L-V</option>
            <option value="L-S">L-S</option>
            <option value="L-D">L-D</option>
            <option value="LMXJV">L,M,X,J,V</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6 }}>
            ¿Quokka provee insumos?
          </label>
          <select
            value={quokkaInsumos}
            onChange={(e) => setQuokkaInsumos(e.target.value as any)}
            style={{ padding: 8, fontSize: 16, width: "100%" }}
          >
            <option value="SI">Sí</option>
            <option value="NO">No</option>
          </select>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
            {quokkaInsumos === "SI"
              ? "Se aplica 8.5% al total semanal."
              : "Sin incremento por insumos."}
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 24 }}>Turnos y dotación</h3>

      {/* Turno 1 */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={turnosActivos.primer}
            onChange={(e) =>
              setTurnosActivos((s) => ({ ...s, primer: e.target.checked }))
            }
          />
          <strong>Primer</strong>
        </label>
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <TimeInput value={t1.in} onChange={(v) => setT1({ ...t1, in: v })} />
          <TimeInput value={t1.out} onChange={(v) => setT1({ ...t1, out: v })} />
          <div style={{ marginLeft: 8 }}>
            <div>Auxiliares</div>
            <NumberSelect
              value={aux.t1}
              onChange={(v) => setAux((s) => ({ ...s, t1: v }))}
            />
          </div>
          <div>
            <div>Supervisores</div>
            <NumberSelect
              value={sup.t1}
              onChange={(v) => setSup((s) => ({ ...s, t1: v }))}
            />
          </div>
        </div>
      </div>

      {/* Turno 2 */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={turnosActivos.segundo}
            onChange={(e) =>
              setTurnosActivos((s) => ({ ...s, segundo: e.target.checked }))
            }
          />
        </label>
        <strong>Segundo</strong>
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <TimeInput value={t2.in} onChange={(v) => setT2({ ...t2, in: v })} />
          <TimeInput value={t2.out} onChange={(v) => setT2({ ...t2, out: v })} />
          <div style={{ marginLeft: 8 }}>
            <div>Auxiliares</div>
            <NumberSelect
              value={aux.t2}
              onChange={(v) => setAux((s) => ({ ...s, t2: v }))}
            />
          </div>
          <div>
            <div>Supervisores</div>
            <NumberSelect
              value={sup.t2}
              onChange={(v) => setSup((s) => ({ ...s, t2: v }))}
            />
          </div>
        </div>
      </div>

      {/* Turno 3 */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={turnosActivos.tercer}
            onChange={(e) =>
              setTurnosActivos((s) => ({ ...s, tercer: e.target.checked }))
            }
          />
          <strong>Tercer</strong>
        </label>
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <TimeInput value={t3.in} onChange={(v) => setT3({ ...t3, in: v })} />
          <TimeInput value={t3.out} onChange={(v) => setT3({ ...t3, out: v })} />
          <div style={{ marginLeft: 8 }}>
            <div>Auxiliares</div>
            <NumberSelect
              value={aux.t3}
              onChange={(v) => setAux((s) => ({ ...s, t3: v }))}
            />
          </div>
          <div>
            <div>Supervisores</div>
            <NumberSelect
              value={sup.t3}
              onChange={(v) => setSup((s) => ({ ...s, t3: v }))}
            />
          </div>
        </div>
      </div>

      {/* Personalizado */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={turnosActivos.custom}
            onChange={(e) =>
              setTurnosActivos((s) => ({ ...s, custom: e.target.checked }))
            }
          />
          <strong>Personalizado</strong>
        </label>
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <TimeInput value={tc.in} onChange={(v) => setTc({ ...tc, in: v })} />
          <TimeInput value={tc.out} onChange={(v) => setTc({ ...tc, out: v })} />
          <div style={{ marginLeft: 8 }}>
            <div>Auxiliares</div>
            <NumberSelect
              value={aux.tc}
              onChange={(v) => setAux((s) => ({ ...s, tc: v }))}
            />
          </div>
          <div>
            <div>Supervisores</div>
            <NumberSelect
              value={sup.tc}
              onChange={(v) => setSup((s) => ({ ...s, tc: v }))}
            />
          </div>
        </div>
      </div>

      {/* Desglose */}
      <h3>Desglose por línea</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={th}>Qty</th>
              <th style={th}>Rol</th>
              <th style={th}>Turno</th>
              <th style={th}>Hrs/persona</th>
              <th style={th}>U. Price</th>
              <th style={{ ...th, textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i}>
                <td style={td}>{l.qty}</td>
                <td style={td}>{l.rol}</td>
                <td style={td}>{l.turno}</td>
                <td style={td}>{l.horasPorPersona.toFixed(1)}</td>
                <td style={td}>{fmtMoney(l.precioUnitarioHora)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtMoney(l.total)}</td>
              </tr>
            ))}
            {lineas.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...td, textAlign: "center" }}>
                  Sin líneas aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <strong>Total por día:</strong>
        <span>{fmtMoney(totalDia)}</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <strong>Total semanal:</strong>
        <span>{fmtMoney(totalConInsumos)}</span>
      </div>

      {/* Acciones */}
      <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
        <button
          onClick={generarPDFServidor}
          disabled={generating || lineas.length === 0}
          style={{
            padding: "10px 16px",
            fontSize: 16,
            borderRadius: 8,
            border: "1px solid #ccc",
            background: generating ? "#ddd" : "#fff",
            cursor: generating ? "not-allowed" : "pointer",
          }}
        >
          {generating ? "Generando..." : "Generar PDF"}
        </button>

        <label
          style={{
            padding: "10px 16px",
            fontSize: 14,
            borderRadius: 8,
            border: "1px dashed #aaa",
            cursor: "pointer",
          }}
        >
          Cargar logo
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const b64 = await fileToDataUrl(f);
              setLogoDataUrl(b64);
            }}
          />
        </label>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #e5e7eb",
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #f1f5f9",
};

async function fileToDataUrl(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `data:${file.type};base64,${b64}`;
}
