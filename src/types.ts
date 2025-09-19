export type Politicas = {
  MargenMin_CleanWay: number
  ["CostoAdministrativo%"]: number
  RecargoNocturno?: number
  FactorInsumosPct?: number // default 0.085 (8.5%)
};
export type Rol = { Rol: string; CostoHora: number; ["Prestaciones%"]: number };
export type EPP = { EPP: string; CostoUnitario: number; VidaUtil_Dias: number; Uso_Diario_Unidades: number };
export type Insumo = { Insumo: string; CostoUnitario: number; Rendimiento_Unidad: number; Unidad: string; Notas?: string };
export type Catalogs = {
  politicas: Politicas;
  roles: Rol[];
  epp: EPP[];
  insumos: Insumo[];
};

export type CleanWayInput = {
  personas: number;
  // Horas se derivan de las horas de entrada/salida
  horaEntrada: string; // "HH:MM"
  horaSalida: string;  // "HH:MM"
  diasSemana: string; // "L-V", "L-S", "L-D" o "L,M,X,J,V"
  turno: string; // etiqueta para mostrar (Diurno/Nocturno o nombre de turno)
  turnoId?: "Primer" | "Segundo" | "Tercer" | "Personalizado";
  insumosProveeQuokka: boolean; // si true, aplicar 8.5% sobre el precio sin insumos
  m2?: number; // opcional, por si se requiere en controles
  supervisionPct?: number; // default 0.10
};

export type CleanWayBreakdown = {
  horasTurno: number;
  costoLaboralDia: number;
  costoEppDia: number;
  supervisionDia: number;
  overheadDia: number;
  subtotalSinInsumosDia: number;
  margenPct: number;
  margenDia: number;
  precioDiaSinInsumos: number;
  insumosPct: number;
  insumosDia: number;
  precioDiaFinal: number;
  precioHoraFinal: number;
  alertas: string[];
};
