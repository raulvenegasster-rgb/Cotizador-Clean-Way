import React, { useMemo, useState } from "react";
import catalogs from "../../data/catalogs.cleanway.json";
import { cotizarCleanWay } from "../engine_cleanway";
import type { CleanWayInput } from "../types";

export default function App() {
  const [personas, setPersonas] = useState(6);
  const [horaEntrada, setHoraEntrada] = useState("06:00");
  const [horaSalida, setHoraSalida] = useState("14:00");
  const [dias, setDias] = useState("L-S");
  const [turno, setTurno] = useState("Diurno");
  const [insumosQuokka, setInsumosQuokka] = useState(true);
  const [m2, setM2] = useState<number|undefined>(1200);

  const input: CleanWayInput = useMemo(()=>({
    personas,
    horaEntrada,
    horaSalida,
    diasSemana: dias,
    turno,
    insumosProveeQuokka: insumosQuokka,
    m2
  }), [personas, horaEntrada, horaSalida, dias, turno, insumosQuokka, m2]);

  const res = useMemo(()=>cotizarCleanWay(catalogs as any, input), [input]);

  return (
    <div style={{ fontFamily: "Inter, system-ui, Arial", padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Clean Way – Cotizador</h1>
      <p style={{ color: "#555", marginTop: 0 }}>Precio por hora con EPP siempre incluido y regla de insumos 8.5% (si Quokka los provee).</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 16 }}>
        <label>Personas
          <input type="number" value={personas} onChange={e=>setPersonas(Number(e.target.value))} min={1} style={{ width: "100%" }}/>
        </label>
        <label>Entrada
          <input type="time" value={horaEntrada} onChange={e=>setHoraEntrada(e.target.value)} style={{ width: "100%" }}/>
        </label>
        <label>Salida
          <input type="time" value={horaSalida} onChange={e=>setHoraSalida(e.target.value)} style={{ width: "100%" }}/>
        </label>
        <label>Días de semana
          <select value={dias} onChange={e=>setDias(e.target.value)} style={{ width: "100%" }}>
            <option value="L-V">L-V</option>
            <option value="L-S">L-S</option>
            <option value="L-D">L-D</option>
            <option value="L,M,X,J,V">L,M,X,J,V</option>
          </select>
        </label>
        <label>Turno
          <select value={turno} onChange={e=>setTurno(e.target.value)} style={{ width: "100%" }}>
            <option>Diurno</option>
            <option>Nocturno</option>
          </select>
        </label>
        <label>¿Quokka provee insumos?
          <select value={insumosQuokka ? "si" : "no"} onChange={e=>setInsumosQuokka(e.target.value==="si")} style={{ width: "100%" }}>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 24, padding: 16, border: "1px solid #eee", borderRadius: 12, background:"#fff" }}>
        <h3>Desglose diario</h3>
        <ul>
          <li>Horas por turno: <b>{res.horasTurno.toFixed(2)}</b></li>
          <li>Costo laboral: ${res.costoLaboralDia.toFixed(2)}</li>
          <li>EPP (siempre incluido): ${res.costoEppDia.toFixed(2)}</li>
          <li>Supervisión: ${res.supervisionDia.toFixed(2)}</li>
          <li>Overhead: ${res.overheadDia.toFixed(2)}</li>
          <li>Subtotal sin insumos: ${res.subtotalSinInsumosDia.toFixed(2)}</li>
          <li>Margen ({Math.round(res.margenPct*100)}%): ${res.margenDia.toFixed(2)}</li>
          <li><b>Precio día sin insumos: ${res.precioDiaSinInsumos.toFixed(0)}</b></li>
          <li>Insumos ({(res.insumosPct*100).toFixed(1)}%): ${res.insumosDia.toFixed(2)}</li>
          <li><b>Precio día final: ${res.precioDiaFinal.toFixed(0)}</b></li>
          <li><b>Precio hora final: ${res.precioHoraFinal.toFixed(2)}</b></li>
        </ul>
        {res.alertas.length > 0 && (
          <div style={{ color: "#b00" }}>
            <b>Alertas:</b> {res.alertas.join(" | ")}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        <p>Políticas: margen min. Clean Way = {(catalogs.politicas.MargenMin_CleanWay*100).toFixed(0)}%, Overhead = {(catalogs.politicas["CostoAdministrativo%"]*100).toFixed(0)}%, Insumos = {(catalogs.politicas.FactorInsumosPct ? catalogs.politicas.FactorInsumosPct*100 : 8.5).toFixed(1)}%.</p>
      </div>
    </div>
  );
}
