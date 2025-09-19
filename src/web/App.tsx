import React, { useEffect, useMemo, useState } from "react";
import catalogsRaw from "../../data/catalogs.cleanway.json";
import { cotizarCleanWay } from "../engine_cleanway";
import type { CleanWayInput, Catalogs } from "../types";

const catalogs = catalogsRaw as unknown as Catalogs;

export default function App() {
  const [personas, setPersonas] = useState(6);
  const [turnoId, setTurnoId] = useState<CleanWayInput["turnoId"]>("Primer");
  const [horaEntrada, setHoraEntrada] = useState("06:00");
  const [horaSalida, setHoraSalida] = useState("14:00");
  const [dias, setDias] = useState("L-S");
  const [turno, setTurno] = useState("Primer");
  const [insumosQuokka, setInsumosQuokka] = useState(true);
  const [m2, setM2] = useState<number|undefined>(1200);

  useEffect(()=>{
    // Auto-fill hours when selecting a standard shift
    if (turnoId === "Primer") { setHoraEntrada("06:00"); setHoraSalida("14:00"); setTurno("Primer"); }
    if (turnoId === "Segundo") { setHoraEntrada("14:00"); setHoraSalida("22:00"); setTurno("Segundo"); }
    if (turnoId === "Tercer") { setHoraEntrada("22:00"); setHoraSalida("06:00"); setTurno("Tercer"); }
    if (turnoId === "Personalizado") { setTurno("Personalizado"); }
  }, [turnoId]);

  const input: CleanWayInput = useMemo(()=>({
    personas,
    horaEntrada,
    horaSalida,
    diasSemana: dias,
    turno,
    turnoId,
    insumosProveeQuokka: insumosQuokka,
    m2
  }), [personas, horaEntrada, horaSalida, dias, turno, turnoId, insumosQuokka, m2]);

  const res = useMemo(()=>cotizarCleanWay(catalogs as any, input), [input]);

  return (
    <div style={{ fontFamily: "Inter, system-ui, Arial", padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Clean Way – Cotizador</h1>
      <p style={{ color: "#555", marginTop: 0 }}>Tres turnos clásicos (8 horas) y nocturno proporcional por horas en 22:00–06:00.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 16 }}>
        <label>Personas
          <input type="number" value={personas} onChange={e=>setPersonas(Number(e.target.value))} min={1} style={{ width: "100%" }}/>
        </label>

        <label>Turno
          <select value={turnoId} onChange={e=>setTurnoId(e.target.value as any)} style={{ width: "100%" }}>
            <option value="Primer">Primer (06:00–14:00)</option>
            <option value="Segundo">Segundo (14:00–22:00)</option>
            <option value="Tercer">Tercer (22:00–06:00)</option>
            <option value="Personalizado">Personalizado</option>
          </select>
        </label>

        <label>Días de semana
          <select value={dias} onChange={e=>setDias(e.target.value)} style={{ width: "100%" }}>
            <option value="L-V">L-V</option>
            <option value="L-S">L-S</option>
            <option value="L-D">L-D</option>
            <option value="L,M,X,J,V">L,M,X,J,V</option>
          </select>
        </label>

        <label>Entrada
          <input type="time" value={horaEntrada} onChange={e=>setHoraEntrada(e.target.value)} disabled={turnoId!=="Personalizado"} style={{ width: "100%" }}/>
        </label>
        <label>Salida
          <input type="time" value={horaSalida} onChange={e=>setHoraSalida(e.target.value)} disabled={turnoId!=="Personalizado"} style={{ width: "100%" }}/>
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
        <p>
          Políticas: margen min. Clean Way = {(catalogs.politicas.MargenMin_CleanWay*100).toFixed(0)}%,
          Overhead = {(catalogs.politicas["CostoAdministrativo%"]*100).toFixed(0)}%,
          Insumos = {(((catalogs.politicas as any).FactorInsumosPct ?? 0.085)*100).toFixed(1)}%.
        </p>
      </div>
    </div>
  );
}
