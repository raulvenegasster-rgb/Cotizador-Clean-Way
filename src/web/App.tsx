import { useMemo, useState } from "react";

/** ====== Config ====== */
const HOURLY_RATE = {
  Auxiliar: 129.52,
  Supervisor: 175.66,
} as const;

type Rol = keyof typeof HOURLY_RATE;
type DaysOption = "L-V" | "L-S" | "L-D" | "L,M,X,J,V";

function daysToNumber(opt: DaysOption) {
  switch (opt) {
    case "L-V":
    case "L,M,X,J,V":
      return 5;
    case "L-S":
      return 6;
    case "L-D":
      return 7;
    default:
      return 5;
  }
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function timeStrToMinutes(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function minutesToHours(min: number) {
  return min / 60;
}
function hoursBetween(startHHMM: string, endHHMM: string) {
  const s = timeStrToMinutes(startHHMM);
  const e = timeStrToMinutes(endHHMM);
  const diff = e >= s ? e - s : e + 24 * 60 - s; // cruza medianoche
  return minutesToHours(diff);
}

type ShiftState = {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  auxiliares: number;
  supervisores: number;
  label: string;
};

type Linea = {
  qty: number;
  rol: Rol;
  turno: string;
  horasPersona: number;
  unitPrice: number;
  total: number;
};

export default function App() {
  // Logo FIJO desde /public
  const logoSrc = "/logo-cleanway.png";

  const [diasOpt, setDiasOpt] = useState<DaysOption>("L-V");
  const diasEfectivos = useMemo(() => daysToNumber(diasOpt), [diasOpt]);

  // SIN pre-cargas
  const [primer, setPrimer] = useState<ShiftState>({
    enabled: true,
    start: "06:00",
    end: "14:00",
    auxiliares: 0,
    supervisores: 0,
    label: "Primer",
  });
  const [segundo, setSegundo] = useState<ShiftState>({
    enabled: true,
    start: "14:00",
    end: "22:00",
    auxiliares: 0,
    supervisores: 0,
    label: "Segundo",
  });
  const [tercer, setTercer] = useState<ShiftState>({
    enabled: true,
    start: "22:00",
    end: "06:00",
    auxiliares: 0,
    supervisores: 0,
    label: "Tercer",
  });
  const [custom, setCustom] = useState<ShiftState>({
    enabled: false,
    start: "06:00",
    end: "14:00",
    auxiliares: 0,
    supervisores: 0,
    label: "Personalizado",
  });

  const lineas: Linea[] = useMemo(() => {
    const shifts = [primer, segundo, tercer, custom].filter((s) => s.enabled);
    const out: Linea[] = [];
    for (const s of shifts) {
      const hrsDia = hoursBetween(s.start, s.end);
      const hrsPorPersona = hrsDia * diasEfectivos;

      if (s.auxiliares > 0) {
        out.push({
          qty: s.auxiliares,
          rol: "Auxiliar",
          turno: s.label,
          horasPersona: hrsPorPersona,
          unitPrice: HOURLY_RATE.Auxiliar,
          total: s.auxiliares * HOURLY_RATE.Auxiliar * hrsPorPersona,
        });
      }
      if (s.supervisores > 0) {
        out.push({
          qty: s.supervisores,
          rol: "Supervisor",
          turno: s.label,
          horasPersona: hrsPorPersona,
          unitPrice: HOURLY_RATE.Supervisor,
          total: s.supervisores * HOURLY_RATE.Supervisor * hrsPorPersona,
        });
      }
    }
    return out;
  }, [primer, segundo, tercer, custom, diasEfectivos]);

  const totalSemanal = useMemo(
    () => lineas.reduce((acc, l) => acc + l.total, 0),
    [lineas]
  );
  const totalDia = useMemo(
    () => (diasEfectivos ? totalSemanal / diasEfectivos : 0),
    [totalSemanal, diasEfectivos]
  );

  function NumberSelect({
    value,
    onChange,
    max = 50,
  }: {
    value: number;
    onChange: (n: number) => void;
    max?: number;
  }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 h-10 rounded-md border border-gray-300 px-3 text-base"
      >
        {Array.from({ length: max + 1 }).map((_, i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
    );
  }

  function ShiftCard({
    s,
    set,
  }: {
    s: ShiftState;
    set: (next: ShiftState) => void;
  }) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => set({ ...s, enabled: e.target.checked })}
          />
          <span className="font-semibold">{s.label}</span>
        </label>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <div>
            <label className="block text-sm text-gray-600">Entrada</label>
            <input
              type="time"
              value={s.start}
              onChange={(e) => set({ ...s, start: e.target.value })}
              className="w-full h-10 rounded-md border border-gray-300 px-3"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Salida</label>
            <input
              type="time"
              value={s.end}
              onChange={(e) => set({ ...s, end: e.target.value })}
              className="w-full h-10 rounded-md border border-gray-300 px-3"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Auxiliares</label>
            <NumberSelect
              value={s.auxiliares}
              onChange={(n) => set({ ...s, auxiliares: n })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Supervisores</label>
            <NumberSelect
              value={s.supervisores}
              onChange={(n) => set({ ...s, supervisores: n })}
            />
          </div>
          <div className="flex items-end">
            <div className="text-sm text-gray-500">
              Hrs/día: <b>{hoursBetween(s.start, s.end).toFixed(1)}</b>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Header con LOGO FIJO */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-28 flex items-center justify-center rounded-lg bg-white border">
            <img
              src={logoSrc}
              alt="Clean Way"
              className="max-h-14 object-contain"
            />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Cotizador Clean Way</h1>
            <p className="text-gray-600 text-sm">Parámetros de cotización</p>
          </div>
        </div>

        {/* Parámetros */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <label className="block text-sm text-gray-600 mb-1">Días</label>
            <select
              value={diasOpt}
              onChange={(e) => setDiasOpt(e.target.value as DaysOption)}
              className="w-full h-10 rounded-md border border-gray-300 px-3"
            >
              <option value="L-V">L-V</option>
              <option value="L-S">L-S</option>
              <option value="L-D">L-D</option>
              <option value="L,M,X,J,V">L,M,X,J,V</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">
              Días efectivos por semana: <b>{diasEfectivos}</b>
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">
              Tarifas:&nbsp;
              <b>Auxiliar {fmtMoney(HOURLY_RATE.Auxiliar)}/h</b> &nbsp;|&nbsp;
              <b>Supervisor {fmtMoney(HOURLY_RATE.Supervisor)}/h</b>
            </p>
          </div>
        </div>

        {/* Turnos */}
        <h2 className="mt-6 mb-2 text-lg font-semibold">Turnos y dotación</h2>
        <div className="grid grid-cols-1 gap-4">
          <ShiftCard s={primer} set={setPrimer} />
          <ShiftCard s={segundo} set={setSegundo} />
          <ShiftCard s={tercer} set={setTercer} />
          <ShiftCard s={custom} set={setCustom} />
        </div>

        {/* Desglose */}
        <h2 className="mt-8 mb-3 text-lg font-semibold">Desglose por línea</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-2 w-16">Qty</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Turno</th>
                <th className="px-4 py-2 text-right">Hrs/persona</th>
                <th className="px-4 py-2 text-right">U. Price</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    Sin dotación seleccionada.
                  </td>
                </tr>
              ) : (
                lineas.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2">{l.qty}</td>
                    <td className="px-4 py-2">{l.rol}</td>
                    <td className="px-4 py-2">{l.turno}</td>
                    <td className="px-4 py-2 text-right">
                      {l.horasPersona.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {fmtMoney(l.unitPrice)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {fmtMoney(l.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
            <b>Total por día:</b> <span className="ml-2">{fmtMoney(totalDia)}</span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
            <b>Total semanal:</b>{" "}
            <span className="ml-2">{fmtMoney(totalSemanal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
