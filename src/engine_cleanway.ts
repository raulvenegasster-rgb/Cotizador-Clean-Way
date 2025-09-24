// src/engine_cleanway.ts
import type {
  CleanWayInput,
  Resultado,
  LineaRol,
  Rol,
  Day,
  ShiftInput,
  WeekendCounts,
  Catalogs,
  CatalogRol,
  CatalogEPP
} from "./types";

/* ================= Utilidades ================= */

function horas(hIn: string, hOut: string): number {
  const [hi, mi] = hIn.split(":").map(Number);
  const [ho, mo] = hOut.split(":").map(Number);
  const ini = hi + mi / 60;
  let fin = ho + mo / 60;
  if (fin <= ini) fin += 24;
  return +(fin - ini).toFixed(2);
}

function diasActivos(input: CleanWayInput): Day[] {
  if (input.dias === "custom") return (input.diasPersonalizados ?? []) as Day[];
  if (input.dias === "L-V") return ["L", "M", "X", "J", "V"];
  if (input.dias === "L-S") return ["L", "M", "X", "J", "V", "S"];
  if (input.dias === "L-D") return ["L", "M", "X", "J", "V", "S", "D"];
  if (input.dias === "L,M,X,J,V") return ["L", "M", "X", "J", "V"];
  return ["L", "M", "X", "J", "V"];
}

const WEEKDAYS: Day[] = ["L", "M", "X", "J", "V"];

function countWeekdays(dias: Day[]): number {
  return WEEKDAYS.filter(d => dias.includes(d)).length;
}

/** Precio hora por rol a partir del catálogo (CostoHora * (1 + Prestaciones%)) */
function buildPrecioHoraPorRol(catalogs: Catalogs): Record<Rol, number> {
  const roles = catalogs.roles ?? [];
  const byRol = new Map<Rol, CatalogRol>();
  roles.forEach(r => byRol.set(r.Rol, r));

  const calc = (rol: Rol, fallbackCostHora: number, fallbackPrest: number) => {
    const r = byRol.get(rol);
    const costHora = r ? r.CostoHora : fallbackCostHora;
    const prest = r && typeof r["Prestaciones%"] === "number" ? r["Prestaciones%"]! : fallbackPrest;
    return +(costHora * (1 + prest)).toFixed(2);
  };

  return {
    Auxiliar: calc("Auxiliar", 70, 0.35),
    Supervisor: calc("Supervisor", 95, 0.35)
  };
}

/** Costo diario de EPP por persona (solo si Quokka provee insumos) */
function eppCostoDiarioPorPersona(catalogs: Catalogs): number {
  const epps: CatalogEPP[] = catalogs.epp ?? [];
  let total = 0;
  for (const e of epps) {
    if (!e.VidaUtil_Dias || e.VidaUtil_Dias <= 0) continue;
    const porDia = (e.CostoUnitario / e.VidaUtil_Dias) * (e.Uso_Diario_Unidades || 0);
    total += porDia;
  }
  return +total.toFixed(4);
}

/* ================= Motor ================= */

export function cotizarCleanWay(catalogs: Catalogs, input: CleanWayInput): Resultado {
  const dias: Day[] = diasActivos(input);
  const nWeekdays = countWeekdays(dias); // puede ser 0..5 según selección
  const lineas: LineaRol[] = [];

  // Precios de mano de obra por hora
  const PRECIO_HORA = buildPrecioHoraPorRol(catalogs);

  // EPP por persona por día (si Quokka provee insumos)
  const eppDiaPersona = input.insumosProveeQuokka ? eppCostoDiarioPorPersona(catalogs) : 0;

  input.shifts.forEach((s: ShiftInput) => {
    const h = horas(s.horaEntrada, s.horaSalida);

    /* --------- 1) Consolidado L-V: UNA sola línea por rol --------- */
    if (nWeekdays > 0 && s.enabled) {
      const pushLV = (rol: Rol, cantidad: number) => {
        if (cantidad <= 0) return;
        const precioHora = PRECIO_HORA[rol];
        const costoManoObra = cantidad * h * precioHora; // por DÍA
        const costoEPP = cantidad * eppDiaPersona;        // por DÍA
        const totalDiaLV = costoManoObra + costoEPP;

        lineas.push({
          turno: s.label,
          rol,
          Cantidad: cantidad,
          horasPorPersona: h,
          precioUnitarioHora: precioHora,
          total: totalDiaLV
          // sin 'dia' para L-V: es intencional, es línea diaria consolidada
        });
      };

      pushLV("Auxiliar", s.auxiliares);
      pushLV("Supervisor", s.supervisores);
    }

    /* --------- 2) Sábado y Domingo: una línea por día si está activo --------- */
    const weekendPush = (day: Day, wk?: WeekendCounts) => {
      if (!wk || !wk.enabled) return;
      const push = (rol: Rol, cantidad: number) => {
        if (cantidad <= 0) return;
        const precioHora = PRECIO_HORA[rol];
        const costoManoObra = cantidad * h * precioHora; // por DÍA
        const costoEPP = cantidad * eppDiaPersona;        // por DÍA
        const total = costoManoObra + costoEPP;

        lineas.push({
          turno: s.label,
          rol,
          Cantidad: cantidad,
          horasPorPersona: h,
          precioUnitarioHora: precioHora,
          total,
          dia: day
        });
      };
      push("Auxiliar", wk.auxiliares);
      push("Supervisor", wk.supervisores);
    };

    if (dias.includes("S")) weekendPush("S", s.weekend?.sabado);
    if (dias.includes("D")) weekendPush("D", s.weekend?.domingo);
  });

  /* --------- Totales --------- */

  // Total diario (solo líneas L-V, que ya representan un DÍA típico entre semana)
  const totalLVporDia = lineas
    .filter(l => l.dia === undefined)
    .reduce((acc, l) => acc + l.total, 0);

  // Totales de S y D (cada línea ya es por día)
  const totalSab = lineas
    .filter(l => l.dia === "S")
    .reduce((acc, l) => acc + l.total, 0);

  const totalDom = lineas
    .filter(l => l.dia === "D")
    .reduce((acc, l) => acc + l.total, 0);

  // Suma semanal: nWeekdays puede ser 0..5 según selección
  const totalSemana =
    totalLVporDia * nWeekdays +
    (dias.includes("S") ? totalSab : 0) +
    (dias.includes("D") ? totalDom : 0);

  const totalDiaPromedio = totalSemana / (dias.length || 1);

  return {
    lineas,
    diasEfectivosSemana: dias.length || 0,
    totalDia: totalDiaPromedio,
    totalSemana
  };
}
