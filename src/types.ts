// src/types.ts

/** ===== Catálogo ===== */

export type Rol = "Auxiliar" | "Supervisor";
export type Day = "L" | "M" | "X" | "J" | "V" | "S" | "D";

export interface Politicas {
  MargenMin_CleanWay?: number;     // opcional por ahora
  "CostoAdministrativo%"?: number; // opcional por ahora
  RecargoNocturno?: number;        // opcional por ahora
  FactorInsumosPct?: number;       // opcional por ahora (no se usa si tenemos EPP)
}

export interface CatalogRol {
  Rol: Rol;
  CostoHora: number;       // costo hora directo
  "Prestaciones%"?: number; // porcentaje adicional de prestaciones (0.35 = 35%)
}

export interface CatalogEPP {
  EPP: string;
  CostoUnitario: number;       // MXN por unidad
  VidaUtil_Dias: number;       // días de vida útil
  Uso_Diario_Unidades: number; // cuántas unidades se consumen por persona por día
}

export interface CatalogInsumo {
  // reservado para futuro
}

export interface Catalogs {
  politicas?: Politicas;
  roles: CatalogRol[];
  epp?: CatalogEPP[];
  insumos?: CatalogInsumo[];
}

/** ===== Input/Output de la cotización ===== */

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
  // Selector global de días. L-V es la base; S/D se añaden si aplica.
  dias: "L-V" | "L-S" | "L-D" | "L,M,X,J,V" | "custom";
  diasPersonalizados?: Day[];
  insumosProveeQuokka: boolean;   // si es true, se cobran EPP
  shifts: ShiftInput[];
  m2?: number;
}

export interface LineaRol {
  turno: string;
  rol: Rol;
  Cantidad: number;
  horasPorPersona: number;
  precioUnitarioHora: number; // solo mano de obra (sin EPP)
  total: number;              // total línea con EPP incluido
  dia?: Day;                  // S o D cuando aplique
}

export interface Resultado {
  lineas: LineaRol[];
  diasEfectivosSemana: number;
  totalDia: number;     // promedio por día activo
  totalSemana: number;
}
