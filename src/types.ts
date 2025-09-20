// src/types.ts
export type Rol = "Auxiliar" | "Supervisor";

export interface ShiftInput {
  enabled: boolean;
  label: "Primer" | "Segundo" | "Tercer" | "Personalizado";
  horaEntrada: string;   // "HH:mm"
  horaSalida: string;    // "HH:mm"
  auxiliares: number;
  supervisores: number;
}

export interface CleanWayInput {
  dias: "L-V" | "L-S" | "L-D" | "L,M,X,J,V" | "custom";
  diasPersonalizados?: string[];
  insumosProveeQuokka: boolean;
  shifts: ShiftInput[];
  m2?: number;
}

export interface LineaRol {
  turno: string;
  rol: Rol;
  Cantidad: number;              // ← clave oficial
  horasPorPersona: number;
  precioUnitarioHora: number;
  total: number;
}

export interface Resultado {
  lineas: LineaRol[];
  diasEfectivosSemana: number;
  totalDia: number;
  totalSemana: number;
}
