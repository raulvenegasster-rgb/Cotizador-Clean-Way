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

/** ================== Utilidades ================== */

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

/** Precio hora por rol a partir del catálogo (CostoHora * (1 + Prestaciones%)) */
function buildPrecioHoraPorRol(catalogs: Catalogs): Record<Rol, number> {
  const map: Record<Rol, number> = {
    Auxiliar: 0,
    Supervisor: 0
  };
  const roles = catalogs.roles ?? [];
  const byRol = new Map<Rol, CatalogRol>();
  roles.forEach(r => byRol.set(r.Rol, r));

  const calc = (rol: Rol, fallback: number) => {
    const r = byRol.get(rol);
    if (!r) return fallback;
    const prestaciones = typeof r["Prestaciones%"] === "number" ? r["Prestaciones%"]! : 0;
    return +(r.CostoHora * (1 + prestaciones)).toFixed(2);
  };

  // Fallback: 70 y 95 con 35% si no existieran en el catálogo
  map.Auxiliar = calc("Auxiliar", +(70 * (1 + 0.35)).toFixed(2));
  map.Supervisor = calc("Supervisor", +(95 * (1 + 0.35)).toFixed(2));
  return map;
}

/** Costo diario de EPP por persona */
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

/** ================== Motor ================== */

export function cotizarCleanWay(catalogs: Catalogs, input: CleanWayInput): Resultado {
  const dias: Day[] = diasActivos(input);
  const lineas: LineaRol[] = [];

  // Precios de mano de obra por hora
  const PRECIO_HORA = buildPrecioHoraPorRol(catalogs);

  // EPP por persona por día (si Quokka provee insumos)
  const eppDiaPersona = input.insumosProveeQuokka ? eppCostoDiarioPorPersona(catalogs) : 0;

  input.shifts.forEach((s: ShiftInput) => {
    const h = horas(s.horaEntrada, s.horaSalida);

    dias.forEach((d: Day) => {
      // Entre semana: usa base del turno si está enabled
      if (d === "L" || d === "M" || d === "X" || d === "J" || d === "V") {
        if (!s.enabled) return;

        const push = (rol: Rol, cantidad: number) => {
          if (cantidad <= 0) return;
          const precioHora = PRECIO_HORA[rol];
          const costoManoObra = cantidad * h * precioHora;
          const costoEPP = cantidad * eppDiaPersona; // EPP por persona por día
          const total = costoManoObra + costoEPP;

          lineas.push({
            turno: s.label,
            rol,
            Cantidad: cantidad,
            horasPorPersona: h,
            precioUnitarioHora: precioHora, // mostramos solo mano de obra
            total
            // sin 'dia' para L-V
          });
        };

        push("Auxiliar", s.auxiliares);
        push("Supervisor", s.supervisores);
        return;
      }

      // Fin de semana: usa override y enabled específico
      const wk: WeekendCounts | undefined =
        d === "S" ? s.weekend?.sabado : s.weekend?.domingo;
      if (!wk || !wk.enabled) return;

      const push = (rol: Rol, cantidad: number) => {
        if (cantidad <= 0) return;
        const precioHora = PRECIO_HORA[rol];
        const costoManoObra = cantidad * h * precioHora;
        const costoEPP = cantidad * eppDiaPersona;
        const total = costoManoObra + costoEPP;

        lineas.push({
          turno: s.label,
          rol,
          Cantidad: cantidad,
          horasPorPersona: h,
          precioUnitarioHora: precioHora,
          total,
          dia: d
        });
      };

      push("Auxiliar", wk.auxiliares);
      push("Supervisor", wk.supervisores);
    });
  });

  // Totales
  const incluyeLV = (["L", "M", "X", "J", "V"] as Day[]).every(d => dias.includes(d));

  const totalLVporDia = lineas
    .filter(l => l.dia === undefined)
    .reduce((acc, l) => acc + l.total, 0);

  const totalSab = lineas
    .filter(l => l.dia === "S")
    .reduce((acc, l) => acc + l.total, 0);

  const totalDom = lineas
    .filter(l => l.dia === "D")
    .reduce((acc, l) => acc + l.total, 0);

  const totalSemana =
    (incluyeLV ? totalLVporDia * 5 : 0) +
    (dias.includes("S") ? totalSab : 0) +
    (dias.includes("D") ? totalDom : 0);

  const totalDia = totalSemana / (dias.length || 1);

  return {
    lineas,
    diasEfectivosSemana: dias.length || 0,
    totalDia,
    totalSemana
  };
}
