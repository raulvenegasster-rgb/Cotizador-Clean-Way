// src/engine_cleanway.ts
import type {
  CleanWayInput,
  Resultado,
  LineaRol,
  Rol,
  Day,
  ShiftInput,
  WeekendCounts
} from "./types";

// Sustituye por tus catálogos reales cuando toque
const PRECIO_HORA: Record<Rol, number> = {
  Auxiliar: 85,
  Supervisor: 120
};

function horas(hIn: string, hOut: string): number {
  const [hi, mi] = hIn.split(":").map(Number);
  const [ho, mo] = hOut.split(":").map(Number);
  const ini = hi + mi / 60;
  let fin = ho + mo / 60;
  if (fin <= ini) fin += 24;
  return +(fin - ini).toFixed(2);
}

function diasActivos(input: CleanWayInput): Day[] {
  if (input.dias === "custom") return input.diasPersonalizados ?? [];
  if (input.dias === "L-V") return ["L", "M", "X", "J", "V"];
  if (input.dias === "L-S") return ["L", "M", "X", "J", "V", "S"];
  if (input.dias === "L-D") return ["L", "M", "X", "J", "V", "S", "D"];
  if (input.dias === "L,M,X,J,V") return ["L", "M", "X", "J", "V"];
  return ["L", "M", "X", "J", "V"];
}

export function cotizarCleanWay(_: unknown, input: CleanWayInput): Resultado {
  const dias = diasActivos(input);
  const lineas: LineaRol[] = [];

  input.shifts.forEach((s: ShiftInput) => {
    const h = horas(s.horaEntrada, s.horaSalida);

    dias.forEach((d: Day) => {
      // Entre semana: usa base del turno si está enabled
      if (["L", "M", "X", "J", "V"].includes(d)) {
        if (!s.enabled) return;
        const push = (rol: Rol, cantidad: number) => {
          if (cantidad <= 0) return;
          const precio = PRECIO_HORA[rol];
          const total = cantidad * h * precio;
          lineas.push({
            turno: s.label,
            rol,
            Cantidad: cantidad,
            horasPorPersona: h,
            precioUnitarioHora: precio,
            total
            // sin 'dia' para L-V
          });
        };
        push("Auxiliar", s.auxiliares);
        push("Supervisor", s.supervisores);
        return;
      }

      // Fin de semana: solo si hay override y está enabled
      const wk: WeekendCounts | undefined =
        d === "S" ? s.weekend?.sabado : s.weekend?.domingo;
      if (!wk || !wk.enabled) return;

      const push = (rol: Rol, cantidad: number) => {
        if (cantidad <= 0) return;
        const precio = PRECIO_HORA[rol];
        const total = cantidad * h * precio;
        lineas.push({
          turno: s.label,
          rol,
          Cantidad: cantidad,
          horasPorPersona: h,
          precioUnitarioHora: precio,
          total,
          dia: d
        });
      };
      push("Auxiliar", wk.auxiliares);
      push("Supervisor", wk.supervisores);
    });
  });

  // Totales semana: 5 días de L-V si están en 'dias', más S/D si fueron incluidos
  const incluyeLV = ["L", "M", "X", "J", "V"].every(d => dias.includes(d));
  // Total diario para L-V (sumando todas las líneas L-V del mismo día)
  const totalLVporDia = lineas
    .filter(l => !l.dia)
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
