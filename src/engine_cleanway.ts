import type { Catalogs, CleanWayInput, CleanWayBreakdown, Rol, EPP } from "./types";

function parseHoras(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h + (m/60);
}

function horasEntre(horaEntrada: string, horaSalida: string): number {
  const he = parseHoras(horaEntrada);
  const hs = parseHoras(horaSalida);
  if (he === 0 && hs === 0) return 0;
  // si salida es menor que entrada, se asume al día siguiente
  let diff = hs - he;
  if (diff <= 0) diff += 24;
  return +(Math.max(0, diff).toFixed(2));
}

function getRol(roles: Rol[], name: string): Rol | undefined {
  return roles.find(r => r.Rol.toLowerCase() === name.toLowerCase());
}

function calcCostoLaboralDia(personas: number, horasTurno: number, rol: Rol, turno: string, recargoNocturnoPct?: number): number {
  const prestaciones = rol["Prestaciones%"] ?? 0;
  const costoHoraFull = rol.CostoHora * (1 + prestaciones);
  let base = personas * horasTurno * costoHoraFull;
  if (turno.toLowerCase().includes("noct")) {
    base += base * (recargoNocturnoPct ?? 0);
  }
  return base;
}

function costoEppDia(epps: EPP[], personas: number): number {
  // EPP siempre incluido
  let total = 0;
  for (const item of epps) {
    const costo = Number(item.CostoUnitario ?? 0);
    const vida = Number(item.VidaUtil_Dias ?? 1);
    const uso = Number(item.Uso_Diario_Unidades ?? 1);
    const costoPorPersonaDia = (costo / Math.max(vida, 1)) * uso;
    total += costoPorPersonaDia;
  }
  return total * personas;
}

export function cotizarCleanWay(catalogs: Catalogs, input: CleanWayInput): CleanWayBreakdown {
  const polit = catalogs.politicas;
  const rolAux = getRol(catalogs.roles, "Auxiliar") || { Rol: "Auxiliar", CostoHora: 70, "Prestaciones%": 0.35 };
  const supervisionPct = input.supervisionPct ?? 0.10;
  const insumosPct = polit.FactorInsumosPct ?? 0.085;

  const horasTurno = horasEntre(input.horaEntrada, input.horaSalida);

  const alertas: string[] = [];
  if (input.personas <= 0) alertas.push("Personas debe ser > 0");
  if (horasTurno <= 0) alertas.push("Horas de turno inválidas (revisa hora de entrada/salida)");

  const costoLaboralDia = calcCostoLaboralDia(input.personas, horasTurno, rolAux, input.turno, polit.RecargoNocturno);
  const eppDia = costoEppDia(catalogs.epp, input.personas);
  const supervisionDia = (costoLaboralDia + eppDia) * supervisionPct;

  const costoDirectoSinInsumos = costoLaboralDia + eppDia + supervisionDia;
  const overheadPct = polit["CostoAdministrativo%"] ?? 0;
  const overheadDia = costoDirectoSinInsumos * overheadPct;
  const subtotalSinInsumosDia = costoDirectoSinInsumos + overheadDia;

  const margenPct = polit.MargenMin_CleanWay ?? 0.2;
  const margenDia = subtotalSinInsumosDia * margenPct;
  const precioDiaSinInsumos = Math.round(subtotalSinInsumosDia + margenDia);

  // Regla de insumos: si Quokka los provee, 8.5% sobre el precio sin insumos
  const insumosDia = input.insumosProveeQuokka ? +(precioDiaSinInsumos * insumosPct).toFixed(2) : 0;
  const precioDiaFinal = Math.round(precioDiaSinInsumos + insumosDia);
  const precioHoraFinal = +(precioDiaFinal / Math.max(1, input.personas * horasTurno)).toFixed(2);

  return {
    horasTurno,
    costoLaboralDia,
    costoEppDia: eppDia,
    supervisionDia,
    overheadDia,
    subtotalSinInsumosDia,
    margenPct,
    margenDia,
    precioDiaSinInsumos,
    insumosPct,
    insumosDia,
    precioDiaFinal,
    precioHoraFinal,
    alertas
  };
}
