import type { Catalogs, CleanWayInput, CleanWayBreakdown, Rol, EPP, ShiftInput, LineaRol } from "./types";

const SHIFT_DEFAULTS: Record<ShiftInput["label"], {in: string, out: string}> = {
  "Primer": { in: "06:00", out: "14:00" },
  "Segundo": { in: "14:00", out: "22:00" },
  "Tercer": { in: "22:00", out: "06:00" },
  "Personalizado": { in: "06:00", out: "14:00" }
};

function parseHoras(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h + (m/60);
}

function horasEntre(horaEntrada: string, horaSalida: string): number {
  const he = parseHoras(horaEntrada);
  const hs = parseHoras(horaSalida);
  if (he === 0 && hs === 0) return 0;
  let diff = hs - he;
  if (diff <= 0) diff += 24;
  return +(Math.max(0, diff).toFixed(2));
}

function horasNocturnas(horaEntrada: string, horaSalida: string): number {
  let start = parseHoras(horaEntrada);
  let end = parseHoras(horaSalida);
  if (end <= start) end += 24;
  const ranges = [[22,24],[24,30]];
  let noct = 0;
  for (const [a,b] of ranges) {
    const s = Math.max(start, a);
    const e = Math.min(end, b);
    const overlap = Math.max(0, e - s);
    noct += overlap;
  }
  return +noct.toFixed(2);
}

function getRol(roles: Rol[], name: string): Rol | undefined {
  return roles.find(r => r.Rol.toLowerCase() === name.toLowerCase());
}

function costoEppPorPersonaDia(epps: EPP[]): number {
  let total = 0;
  for (const item of epps) {
    const costo = Number(item.CostoUnitario ?? 0);
    const vida = Number(item.VidaUtil_Dias ?? 1);
    const uso = Number(item.Uso_Diario_Unidades ?? 1);
    const costoPorPersonaDia = (costo / Math.max(vida, 1)) * uso;
    total += costoPorPersonaDia;
  }
  return total;
}

function diasToCount(dias: string, personalizados?: string[]): number {
  const map: Record<string, number> = {"L-V":5, "L-S":6, "L-D":7, "L,M,X,J,V":5};
  if (map[dias] !== undefined) return map[dias];
  if (dias === "custom" && personalizados) {
    const unique = new Set(personalizados.map(s => s.trim()).filter(Boolean));
    return Math.min(7, unique.size);
  }
  return 5;
}

export function cotizarCleanWay(catalogs: Catalogs, input: CleanWayInput): CleanWayBreakdown {
  const polit = catalogs.politicas;
  const rolAux = getRol(catalogs.roles, "Auxiliar") || { Rol: "Auxiliar", CostoHora: 70, "Prestaciones%": 0.35 };
  const rolSup = getRol(catalogs.roles, "Supervisor") || { Rol: "Supervisor", CostoHora: 95, "Prestaciones%": 0.35 };
  const insumosPct = polit.FactorInsumosPct ?? 0.085;
  const recNocturnoPct = polit.RecargoNocturno ?? 0;

  const diasEfectivos = diasToCount(input.dias, input.diasPersonalizados);
  const eppPersonaDia = costoEppPorPersonaDia(catalogs.epp);

  type Parcial = {
    turno: string;
    role: "Auxiliar" | "Supervisor";
    qty: number;
    horas: number;
    directo: number;
  };
  const parciales: Parcial[] = [];
  const horasNocturnasPorTurno: Record<string, number> = {};
  const alertas: string[] = [];

  for (const s of input.shifts) {
    if (!s.enabled) continue;
    const def = SHIFT_DEFAULTS[s.label];
    const inH = s.horaEntrada || def.in;
    const outH = s.horaSalida || def.out;
    const horas = horasEntre(inH, outH);
    if (horas <= 0) { alertas.push(`Horas inválidas en turno ${s.label}`); continue; }
    const hNoct = horasNocturnas(inH, outH);
    horasNocturnasPorTurno[s.label] = hNoct;

    if (s.auxiliares > 0) {
      const costoHoraFull = rolAux.CostoHora * (1 + (rolAux["Prestaciones%"] ?? 0));
      const base = s.auxiliares * horas * costoHoraFull;
      const recNoct = base * recNocturnoPct * (hNoct / horas);
      const labor = base + recNoct;
      const epp = eppPersonaDia * s.auxiliares;
      parciales.push({ turno: s.label, role: "Auxiliar", qty: s.auxiliares, horas, directo: +(labor + epp).toFixed(2) });
    }

    if (s.supervisores > 0) {
      const costoHoraFull = rolSup.CostoHora * (1 + (rolSup["Prestaciones%"] ?? 0));
      const base = s.supervisores * horas * costoHoraFull;
      const recNoct = base * recNocturnoPct * (hNoct / horas);
      const labor = base + recNoct;
      const epp = eppPersonaDia * s.supervisores;
      parciales.push({ turno: s.label, role: "Supervisor", qty: s.supervisores, horas, directo: +(labor + epp).toFixed(2) });
    }
  }

  const directoTotal = parciales.reduce((a,b)=>a+b.directo, 0);
  const overhead = directoTotal * (polit["CostoAdministrativo%"] ?? 0);
  const subtotalSinInsumos = directoTotal + overhead;
  const margen = subtotalSinInsumos * (polit.MargenMin_CleanWay ?? 0.2);
  const precioSinInsumos = subtotalSinInsumos + margen;
  const insumos = input.insumosProveeQuokka ? precioSinInsumos * insumosPct : 0;
  const precioFinal = precioSinInsumos + insumos;

  const diasEfectivosSemana = diasEfectivos;

  const lineas = parciales.map(p => {
    const share = directoTotal > 0 ? p.directo / directoTotal : 0;
    const totalLineaDia = p.directo + overhead*share + margen*share + insumos*share;
    const horasPersonaSemana = p.horas * diasEfectivosSemana;
    const unitHora = p.qty > 0 && p.horas > 0 ? +(totalLineaDia / (p.qty * p.horas)).toFixed(2) : 0;
    return {
      turno: p.turno,
      rol: p.role,
      qty: p.qty,
      horasPorPersona: +horasPersonaSemana.toFixed(1),
      precioUnitarioHora: unitHora,
      total: +(totalLineaDia * diasEfectivosSemana).toFixed(2)
    };
  });

  const totalDia = +precioFinal.toFixed(2);
  const totalSemana = +(totalDia * diasEfectivosSemana).toFixed(2);
  const horasTotales = parciales.reduce((a,b)=> a + b.horas * b.qty, 0);
  const precioHoraPromedio = horasTotales > 0 ? +(totalDia / horasTotales).toFixed(2) : 0;

  return {
    diasEfectivosSemana,
    horasNocturnasPorTurno,
    lineas,
    totalDia,
    totalSemana,
    precioHoraPromedio,
    alertas
  };
}
