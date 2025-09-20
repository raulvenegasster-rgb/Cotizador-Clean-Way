// src/web/App.tsx
import React, { useMemo, useState } from "react";

/** ---------- Helpers de formato ---------- */
const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

const num = (n: number, d = 1) =>
  n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });

/** ---------- Modelos ---------- */
type TurnoId = "Primer" | "Segundo" | "Tercer" | "Personalizado";

interface TurnoState {
  enabled: boolean;
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
  auxiliares: number;
  supervisores: number;
}

interface Linea {
  qty: number;
  rol: "Auxiliar" | "Supervisor";
  turno: TurnoId;
  horasPorPersona: number; // por semana
  precioUnitarioHora: number;
  total: number;
}

/** ---------- Tarifas ---------- */
// Base (por hora)
const AUX_RATE = 129.52;
const SUP_RATE = 175.66;
// 3er turno con prima ~15%
const THIRD_PREMIUM = 1.15;

function rateFor(rol: Linea["rol"], turno: TurnoId) {
  const base = rol === "Auxiliar" ? AUX_RATE : SUP_RATE;
  return turno === "Tercer" ? base * THIRD_PREMIUM : base;
}

/** ---------- Utilidades de tiempo ---------- */
function minutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

/** diferencia en horas considerando cruce de medianoche */
function hoursBetween(start: string, end: string) {
  const s = minutes(start);
  const e = minutes(end);
  const diffMin = e >= s ? e - s : 24 * 60 - (s - e);
  return diffMin / 60;
}

/** ---------- Componente principal ---------- */
export default function App() {
  // Parámetros superiores
  const [diasSemana, setDiasSemana] = useState<"L-V" | "L-S">("L-S");
  const [insumos, setInsumos] = useState<"Sí" | "No">("Sí");

  const diasEfectivos = diasSemana === "L-V" ? 5 : 6;

  // Estado por turno
  const [turnos, setTurnos] = useState<Record<TurnoId, TurnoState>>({
    Primer: {
      enabled: true,
      start: "06:00",
      end: "14:00",
      auxiliares: 0,
      supervisores: 0,
    },
    Segundo: {
      enabled: true,
      start: "14:00",
      end: "22:00",
      auxiliares: 0,
      supervisores: 0,
    },
    Tercer: {
      enabled: true,
      start: "22:00",
      end: "06:00",
      auxiliares: 0,
      supervisores: 0,
    },
    Personalizado: {
      enabled: false,
      start: "06:00",
      end: "14:00",
      auxiliares: 0,
      supervisores: 0,
    },
  });

  /** genera opciones 0..20 */
  const peopleOpts = useMemo(() => Array.from({ length: 21 }, (_, i) => i), []);

  /** cálculo de líneas y totales */
  const { lineas, totalDia, totalSemana } = useMemo(() => {
    const result: Linea[] = [];

    (Object.keys(turnos) as TurnoId[]).forEach((tid) => {
      const t = turnos[tid];
      if (!t.enabled) return;

      const horasDia = hoursBetween(t.start, t.end);
      const horasSemana = horasDia * diasEfectivos;

      if (t.auxiliares > 0) {
        const precio = rateFor("Auxiliar", tid);
        const total = t.auxiliares * horasSemana * precio;
        result.push({
          qty: t.auxiliares,
          rol: "Auxiliar",
          turno: tid,
          horasPorPersona: horasSemana,
          precioUnitarioHora: precio,
          total,
        });
      }

      if (t.supervisores > 0) {
        const precio = rateFor("Supervisor", tid);
        const total = t.supervisores * horasSemana * precio;
        result.push({
          qty: t.supervisores,
          rol: "Supervisor",
          turno: tid,
          horasPorPersona: horasSemana,
          precioUnitarioHora: precio,
          total,
        });
      }
    });

    const semana = result.reduce((acc, l) => acc + l.total, 0);
    const dia = semana / diasEfectivos;

    // Si insumos == "Sí" aplicar 8.5% adicional (como tenían)
    const factorInsumos = insumos === "Sí" ? 1.085 : 1;
    return {
      lineas: result,
      totalSemana: semana * factorInsumos,
      totalDia: dia * factorInsumos,
    };
  }, [turnos, diasEfectivos, insumos]);

  /** setters */
  const setTurno = (k: TurnoId, patch: Partial<TurnoState>) =>
    setTurnos((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));

  return (
    <div className="min-h-screen bg-slate-200/60">
      {/* Barra superior con logo y título */}
      <header className="mx-auto max-w-6xl px-6 pt-8">
        <div className="flex items-center gap-4">
          <img
            src="/logo_cleanway.svg"
            alt="CLEAN WAY"
            className="h-10 w-auto select-none"
            draggable={false}
            onError={(e) => {
              // por si no existe ese asset en tu repo, mostramos un placeholder
              (e.currentTarget as HTMLImageElement).src =
                "https://dummyimage.com/140x40/5b21b6/ffffff&text=CLEAN+WAY";
            }}
          />
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Cotizador Clean Way</h1>
            <p className="text-xs text-slate-500 -mt-0.5">Parámetros de cotización</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-14">
        {/* Controles superiores */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Días de semana</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={diasSemana}
              onChange={(e) => setDiasSemana(e.target.value as any)}
            >
              <option value="L-V">L-V</option>
              <option value="L-S">L-S</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">¿Quokka provee insumos?</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={insumos}
              onChange={(e) => setInsumos(e.target.value as any)}
            >
              <option>Sí</option>
              <option>No</option>
            </select>
          </div>
        </div>

        {/* Turnos */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">
            Turnos y dotación por turno
          </h2>

          {(
            [
              ["Primer", "06:00", "14:00"] as const,
              ["Segundo", "14:00", "22:00"] as const,
              ["Tercer", "22:00", "06:00"] as const,
              ["Personalizado", "06:00", "14:00"] as const,
            ] as const
          ).map(([id, defStart, defEnd]) => {
            const t = turnos[id];
            return (
              <div
                key={id}
                className="mb-4 rounded-2xl bg-white/80 px-4 py-4 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={t.enabled}
                    onChange={(e) => setTurno(id, { enabled: e.target.checked })}
                  />
                  <span className="font-medium text-slate-700">{id}</span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-5">
                  {/* Entrada */}
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Entrada</label>
                    <input
                      type="time"
                      value={t.start}
                      onChange={(e) => setTurno(id, { start: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                  </div>

                  {/* Salida */}
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Salida</label>
                    <input
                      type="time"
                      value={t.end}
                      onChange={(e) => setTurno(id, { end: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                  </div>

                  {/* Auxiliares */}
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Auxiliares</label>
                    <select
                      disabled={!t.enabled}
                      value={t.auxiliares}
                      onChange={(e) =>
                        setTurno(id, { auxiliares: parseInt(e.target.value, 10) })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    >
                      {peopleOpts.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Supervisores */}
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Supervisores</label>
                    <select
                      disabled={!t.enabled}
                      value={t.supervisores}
                      onChange={(e) =>
                        setTurno(id, { supervisores: parseInt(e.target.value, 10) })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    >
                      {peopleOpts.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Horas/semana (solo lectura) */}
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Hrs/semana</label>
                    <div className="h-[42px] flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
                      {num(hoursBetween(t.start, t.end) * diasEfectivos, 1)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Detalle / Tabla (SIN botón PDF) */}
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Desglose por línea</h2>

          <div className="rounded-xl overflow-hidden bg-white/70 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="px-4 py-3 text-left">Cantidad</th>
                  <th className="px-4 py-3 text-left">Rol</th>
                  <th className="px-4 py-3 text-left">Turno</th>
                  <th className="px-4 py-3 text-left">Hrs/persona</th>
                  <th className="px-4 py-3 text-left">Precio/hora</th>
                  <th className="px-4 py-3 text-left">Total</th>
                </tr>
              </thead>

              <tbody>
                {lineas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      No hay líneas para mostrar.
                    </td>
                  </tr>
                ) : (
                  lineas.map((l, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="px-4 py-3">{l.qty}</td>
                      <td className="px-4 py-3">{l.rol}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-slate-100">
                          {l.turno}
                        </span>
                      </td>
                      <td className="px-4 py-3">{num(l.horasPorPersona, 1)}</td>
                      <td className="px-4 py-3">{money(l.precioUnitarioHora)}</td>
                      <td className="px-4 py-3">{money(l.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Totales */}
            <div className="flex items-center justify-end gap-6 px-4 py-4 border-t border-slate-200">
              <div className="text-sm">
                <span className="font-medium">Total por día:</span>{" "}
                <span>{money(totalDia)} MXN</span>
              </div>
              <div className="text-sm">
                <span className="font-medium">Total semanal:</span>{" "}
                <span>{money(totalSemana)} MXN</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
