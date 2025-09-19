import fs from "node:fs";
import path from "node:path";
import { cotizarCleanWay } from "./engine_cleanway.js";
import type { Catalogs, CleanWayInput, ShiftInput } from "./types.js";

const catalogsPath = path.resolve("data/catalogs.cleanway.json");
const catalogs: Catalogs = JSON.parse(fs.readFileSync(catalogsPath, "utf-8"));

function main() {
  const shifts: ShiftInput[] = [
    { enabled: true, label: "Primer", horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 6, supervisores: 1 },
    { enabled: true, label: "Segundo", horaEntrada: "14:00", horaSalida: "22:00", auxiliares: 6, supervisores: 1 },
    { enabled: true, label: "Tercer", horaEntrada: "22:00", horaSalida: "06:00", auxiliares: 6, supervisores: 1 },
    { enabled: false, label: "Personalizado", horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 0, supervisores: 0 }
  ];

  const input: CleanWayInput = {
    dias: "L-V",
    insumosProveeQuokka: true,
    shifts
  };

  const res = cotizarCleanWay(catalogs, input);
  console.log(JSON.stringify({ input, res }, null, 2));
}
