// src/types.ts
export type Rol = "Auxiliar" | "Supervisor";
export type Day = "L" | "M" | "X" | "J" | "V" | "S" | "D";

export interface WeekendCounts {
  enabled: boolean;     // si opera ese día
  auxiliares: number;
  supervisores: number;
}

export interface ShiftInput {
  enabled: boolean;     // habilita el turno en L-V
  label: "Primer" | "Segundo" | "Tercer" | "Personalizado";
  horaEntrada: string;  // "HH:mm"
  horaSalida: string;   // "HH:mm"
  auxiliares: number;   // base L-V
  supervisores: number; // base L-V

  // Configuración específica fin de semana
  weekend?: {
    sabado?: WeekendCounts;
    domingo?: WeekendCounts;
  };

  // Flag de UI para mostrar/ocultar la sección de fin de semana por turno
  useWeekend?: boolean;
}

export interface CleanWayInput {
  // Seguimos usando este union para el selector global
  dias: "L-V" | "L-S" | "L-D" | "L,M,X,J,V" | "custom";
  diasPersonalizados?: Day[];
  insumosProveeQuokka: boolean;
  shifts: ShiftInput[];
  m2?: number;
}

export interface LineaRol {
  turno: string;
  rol: Rol;
  Cantidad: number;
  horasPorPersona: number;
  precioUnitarioHora: number;
  total: number;
  dia?: Day;               // S o D cuando aplique
}

export interface Resultado {
  lineas: LineaRol[];
  diasEfectivosSemana: number;
  totalDia: number;        // promedio por día activo
  totalSemana: number;
}
