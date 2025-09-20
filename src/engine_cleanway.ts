// src/engine_cleanway.ts
import type { CleanWayInput, Resultado, LineaRol, Rol } from "./types";

// Ejemplo de costos unitarios por rol; ajusta a tus catálogos reales
const PRECIO_HORA: Record<Rol, number> = {
  Auxiliar: 85,
  Supervisor: 120
};

function horas(hIn: string, hOut: string): number {
  // calcula horas; si salida < entrada, es al día siguiente
  const [hi, mi] = hIn.split(":").map(Number);
  const [ho, mo] = hOut.split(":").map(Number);
  const ini = hi + mi / 60;
  let fin = ho + mo / 60;
  if (fin <= ini) fin += 24;
  return +(fin - ini).toFixed(2);
}

export function cotizarCleanWay(_: any, input: CleanWayInput): Resultado {
  const diasEfectivosSemana =
    input.dias === "custom"
      ? (input.diasPersonalizados?.length ?? 0)
      : input.dias === "L-V"
      ? 5
      : input.dias === "L-S"
      ? 6
      : input.dias === "L-D"
      ? 7
      : 5;

  const lineas: LineaRol[] = [];

  input.shifts.forEach(s => {
    if (!s.enabled) return;
    const h = horas(s.horaEntrada, s.horaSalida);

    const push = (rol: Rol, cantidad: number) => {
      if (cantidad <= 0) return;
      const precio = PRECIO_HORA[rol];
      const total = cantidad * h * precio;
      lineas.push({
        turno: s.label,
        rol,
        Cantidad: cantidad,            // ← aquí el cambio
        horasPorPersona: h,
        precioUnitarioHora: precio,
        total
      });
    };

    push("Auxiliar", s.auxiliares);
    push("Supervisor", s.supervisores);
  });

  const totalDia = lineas.reduce((acc, l) => acc + l.total, 0);
  const totalSemana = totalDia * diasEfectivosSemana;

  return {
    lineas,
    diasEfectivosSemana,
    totalDia,
    totalSemana
  };
}
