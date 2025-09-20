export type Politicas = {
  MargenMin_CleanWay: number;
  ["CostoAdministrativo%"]: number;
  RecargoNocturno?: number;
  FactorInsumosPct?: number; // default 0.085 (8.5%)
};

export type Rol = { Rol: string; CostoHora: number; ["Prestaciones%"]: number };

export type EPP = { EPP: string; CostoUnitario: number; VidaUtil_Dias: number; Uso_Diario_Unidades: number };

export type Catalogs = {
  politicas: Politicas;
  roles: Rol[];
  epp: EPP[];
  insumos: any[];
};

export type ShiftInput = {
  enabled: boolean;
  label: "Primer" | "Segundo" | "Tercer" | "Personalizado";
  horaEntrada: string;
  horaSalida: string;
  auxiliares: number;
  supervisores: number;
};

export type CleanWayInput = {
  dias: string;
  diasPersonalizados?: string[];
  insumosProveeQuokka: boolean;
  shifts: ShiftInput[];
  m2?: number;
};

export type LineaRol = {
  turno: string;
  rol: "Auxiliar" | "Supervisor";
  qty: number;
  horasPorPersona: number;
  precioUnitarioHora: number;
  total: number;
};

export type CleanWayBreakdown = {
  diasEfectivosSemana: number;
  horasNocturnasPorTurno: Record<string, number>;
  lineas: LineaRol[];
  totalDia: number;
  totalSemana: number;
  precioHoraPromedio: number;
  alertas: string[];
};
