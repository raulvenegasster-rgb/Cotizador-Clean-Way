// src/web/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import catalogsRaw from "../../data/catalogs.cleanway.json";
import { cotizarCleanWay } from "../engine_cleanway";
import type {
  CleanWayInput,
  ShiftInput,
  Resultado,
  LineaRol,
  WeekendCounts,
  Catalogs
} from "../types";

const fmtMXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2
});

const defaultShifts: ShiftInput[] = [
  { enabled: true,  label: "Primer",        horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 0, supervisores: 0, weekend: {}, useWeekend: false },
  { enabled: false, label: "Segundo",       horaEntrada: "14:00", horaSalida: "22:00", auxiliares: 0, supervisores: 0, weekend: {}, useWeekend: false },
  { enabled: false, label: "Tercer",        horaEntrada: "22:00", horaSalida: "06:00", auxiliares: 0, supervisores: 0, weekend: {}, useWeekend: false },
  { enabled: false, label: "Personalizado", horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 0, supervisores: 0, weekend: {}, useWeekend: false }
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
  // Base: L-V
  const [dias, setDias] = useState<CleanWayInput["dias"]>("L-V");
  // Toggles globales para habilitar S/D
  const [incluirSabado, setIncluirSabado] = useState(false);
  const [incluirDomingo, setIncluirDomingo] = useState(false);

  const [insumosQuokka, setInsumosQuokka] = useState(true);
  const [shifts, setShifts] = useState<ShiftInput[]>(defaultShifts);

  // FIX: tipado correcto del catálogo
  const catalogs = catalogsRaw as Catalogs;

  // sincroniza selector global con toggles S/D
  useEffect(() => {
    if (incluirSabado && incluirDomingo) setDias("L-D");
    else if (incluirSabado && !incluirDomingo) setDias("L-S");
    else if (!incluirSabado && !incluirDomingo) setDias("L-V");
  }, [incluirSabado, incluirDomingo]);

  const input: CleanWayInput = useMemo(
    () => ({
      dias,
      diasPersonalizados: undefined,
      insumosProveeQuokka: insumosQuokka,
      shifts,
      m2: undefined
    }),
    [dias, insumosQuokka, shifts]
  );

  const res: Resultado = useMemo(() => cotizarCleanWay(catalogs, input), [catalogs, input]);

  function updateShift(i: number, patch: Partial<ShiftInput>) {
    setShifts(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function updateWeekend(i: number, day: "S" | "D", patch: Partial<WeekendCounts>) {
    setShifts(prev =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        const weekend = { ...(s.weekend ?? {}) };
        const current =
          day === "S"
            ? { enabled: false, auxiliares: 0, supervisores: 0, ...(weekend.sabado ?? {}) }
            : { enabled: false, auxiliares: 0, supervisores: 0, ...(weekend.domingo ?? {}) };
        const next = { ...current, ...patch };
        if (day === "S") weekend.sabado = next;
        else weekend.domingo = next;
        return { ...s, weekend };
      })
    );
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

      {/* Controles superiores */}
      <div className="grid-ctrls">
        <label>
          Días de semana
          <select value={diasToLabel(dias)} onChange={e => setDias(e.target.value as CleanWayInput["dias"])}>
            <option value="L-V">L-V</option>
            <option value="L-S">L-S</option>
            <option value="L-D">L-D</option>
            <option value="L,M,X,J,V">L,M,X,J,V</option>
            <option value="Personalizado" disabled>Personalizado</option>
          </select>
        </label>

        <label>
          ¿Quokka provee insumos?
          <select value={insumosQuokka ? "si" : "no"} onChange={e => setInsumosQuokka(e.target.value === "si")}>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </label>

        {/* Activadores de fin de semana */}
        <div className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={incluirSabado} onChange={e => setIncluirSabado(e.target.checked)} />
            <span>Incluir sábado</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={incluirDomingo} onChange={e => setIncluirDomingo(e.target.checked)} />
            <span>Incluir domingo</span>
          </label>
          <div className="subtle">Activa y define cantidades por turno abajo.</div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Turnos y dotación por turno</h3>
        {shifts.map((s, i) => (
          <div key={i} className={`card ${s.enabled ? "shift-card--active" : ""}`} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 160px 160px 160px 160px 160px",
                gap: 12,
                alignItems: "end"
              }}
            >
              {/* Activo L-V */}
              <div>
                <label style={{ marginBottom: 6, display: "block" }}>Activo (L-V)</label>
                <input
                  type="checkbox"
                  className="radio-circle"
                  aria-label={`Activar turno ${i + 1} L-V`}
                  checked={s.enabled}
                  onChange={() => updateShift(i, { enabled: !s.enabled })}
                />
              </div>

              <label>
                Turno
                <select
                  value={s.label}
                  onChange={e => updateShift(i, { label: e.target.value as ShiftInput["label"] })}
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
                Auxiliares L-V
                <select
                  value={s.auxiliares}
                  onChange={e => updateShift(i, { auxiliares: Number(e.target.value) })}
                >
                  {range(50).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              <label>
                Supervisores L-V
                <select
                  value={s.supervisores}
                  onChange={e => updateShift(i, { supervisores: Number(e.target.value) })}
                >
                  {range(50).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Fin de semana por turno (solo si S/D activados) */}
            {(incluirSabado || incluirDomingo) && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!s.useWeekend}
                    onChange={e => updateShift(i, { useWeekend: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>Configurar fin de semana para este turno</span>
                </label>

                {s.useWeekend && (
                  <div className="card" style={{ marginTop: 10 }}>
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Día</th>
                          <th>Activo</th>
                          <th className="num">Auxiliares</th>
                          <th className="num">Supervisores</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incluirSabado && (
                          <tr>
                            <td>Sábado</td>
                            <td>
                              <input
                                type="checkbox"
                                checked={!!s.weekend?.sabado?.enabled}
                                onChange={e =>
                                  updateWeekend(i, "S", {
                                    enabled: e.target.checked,
                                    auxiliares: s.weekend?.sabado?.auxiliares ?? 0,
                                    supervisores: s.weekend?.sabado?.supervisores ?? 0
                                  })
                                }
                              />
                            </td>
                            <td className="num">
                              <input
                                type="number"
                                min={0}
                                value={s.weekend?.sabado?.auxiliares ?? 0}
                                onChange={e => updateWeekend(i, "S", { auxiliares: Number(e.target.value) })}
                                style={{ width: 90 }}
                              />
                            </td>
                            <td className="num">
                              <input
                                type="number"
                                min={0}
                                value={s.weekend?.sabado?.supervisores ?? 0}
                                onChange={e => updateWeekend(i, "S", { supervisores: Number(e.target.value) })}
                                style={{ width: 90 }}
                              />
                            </td>
                          </tr>
                        )}

                        {incluirDomingo && (
                          <tr>
                            <td>Domingo</td>
                            <td>
                              <input
                                type="checkbox"
                                checked={!!s.weekend?.domingo?.enabled}
                                onChange={e =>
                                  updateWeekend(i, "D", {
                                    enabled: e.target.checked,
                                    auxiliares: s.weekend?.domingo?.auxiliares ?? 0,
                                    supervisores: s.weekend?.domingo?.supervisores ?? 0
                                  })
                                }
                              />
                            </td>
                            <td className="num">
                              <input
                                type="number"
                                min={0}
                                value={s.weekend?.domingo?.auxiliares ?? 0}
                                onChange={e => updateWeekend(i, "D", { auxiliares: Number(e.target.value) })}
                                style={{ width: 90 }}
                              />
                            </td>
                            <td className="num">
                              <input
                                type="number"
                                min={0}
                                value={s.weekend?.domingo?.supervisores ?? 0}
                                onChange={e => updateWeekend(i, "D", { supervisores: Number(e.target.value) })}
                                style={{ width: 90 }}
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="subtle" style={{ marginTop: 6 }}>
                      Si el día no está “Activo”, no se contabiliza aunque pongas cantidades.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Desglose por línea</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Día</th>
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
                <td>{l.dia ?? "L-V"}</td>
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

        <div className="totals">
          <span>Promedio por día: {fmtMXN.format(res.totalDia)} MXN</span>
          <span>Total semanal: {fmtMXN.format(res.totalSemana)} MXN</span>
        </div>
      </div>
    </div>
  );
}
