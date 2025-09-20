// src/types.ts
export type Rol = "Auxiliar" | "Supervisor";

/** Catálogos mínimos para que compile.
 *  Ajusta campos si luego usas más propiedades reales.
 */
export interface Catalogs {
  // pon aquí lo que realmente tengas en data/catalogs.cleanway.json
  // lo dejamos laxo para no bloquear el build
  [k: string]: unknown;
}

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
  Cantidad: number;              // ← clave oficial que tú pediste
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
