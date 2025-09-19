import fs from "node:fs";
import path from "node:path";
import { cotizarCleanWay } from "./engine_cleanway.js";
import type { Catalogs, CleanWayInput } from "./types.js";

const catalogsPath = path.resolve("data/catalogs.cleanway.json");
const catalogs: Catalogs = JSON.parse(fs.readFileSync(catalogsPath, "utf-8"));

function parseArgs(): CleanWayInput {
  const args = Object.fromEntries(process.argv.slice(2).map(s => {
    const [k, v] = s.split("=");
    return [k.replace(/^--/, ""), v];
  }));

  const personas = Number(args.personas ?? 6);
  const horaEntrada = String(args.in ?? "06:00");
  const horaSalida  = String(args.out ?? "14:00");
  const diasSemana = String(args.dias ?? "L-S");
  const turno = String(args.turno ?? "Diurno");
  const insumosProveeQuokka = String(args.insumos ?? "si").toLowerCase().startsWith("s");
  const m2 = args.m2 ? Number(args.m2) : undefined;

  return { personas, horaEntrada, horaSalida, diasSemana, turno, insumosProveeQuokka, m2 };
}

const input = parseArgs();
const res = cotizarCleanWay(catalogs, input);
console.log(JSON.stringify({ input, res }, null, 2));
