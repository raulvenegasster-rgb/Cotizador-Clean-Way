import React, { useEffect, useMemo, useState } from "react";
import catalogsRaw from "../../data/catalogs.cleanway.json";
import { cotizarCleanWay } from "../engine_cleanway";
import type { CleanWayInput, Catalogs, ShiftInput } from "../types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const catalogs = catalogsRaw as unknown as Catalogs;

const defaultShifts: ShiftInput[] = [
  { enabled: true,  label: "Primer",       horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Segundo",      horaEntrada: "14:00", horaSalida: "22:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Tercer",       horaEntrada: "22:00", horaSalida: "06:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Personalizado",horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 0, supervisores: 0 }
];

function diasToLabel(d: string) {
  if (d === "L-V") return "L-V";
  if (d === "L-S") return "L-S";
  if (d === "L-D") return "L-D";
  if (d === "L,M,X,J,V") return "L,M,X,J,V";
  return "Personalizado";
}

export default function App() {
  const [dias, setDias] = useState<string>("L-S");
  const [diasPers, setDiasPers] = useState<string[]>(["L","M","X","J","V"]);
  const [insumosQuokka, setInsumosQuokka] = useState(true);
  const [shifts, setShifts] = useState<ShiftInput[]>(defaultShifts);

  useEffect(()=>{
    if (dias === "L-V") setDiasPers(["L","M","X","J","V"]);
  }, [dias]);

  const input: CleanWayInput = useMemo(()=> ({
    dias,
    diasPersonalizados: dias === "custom" ? diasPers : (dias === "L,M,X,J,V" ? ["L","M","X","J","V"] : undefined),
    insumosProveeQuokka: insumosQuokka,
    shifts,
    m2: undefined
  }), [dias, diasPers, insumosQuokka, shifts]);

  const res = useMemo(()=>cotizarCleanWay(catalogs as any, input), [input]);

  function updateShift(i: number, patch: Partial<ShiftInput>) {
    setShifts(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }

  function toggleDia(d: string) {
    setDias("custom");
    setDiasPers(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function generarPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Cotizador Clean Way", 14, 18);
    doc.setFontSize(10);
    doc.text(`Días efectivos por semana: ${res.diasEfectivosSemana}`, 14, 26);
    doc.text(`Políticas: Margen ${(catalogs.politicas.MargenMin_CleanWay*100).toFixed(0)}% | Overhead ${(catalogs.politicas["CostoAdministrativo%"]*100).toFixed(0)}% | Insumos ${(((catalogs.politicas as any).FactorInsumosPct ?? 0.085)*100).toFixed(1)}%`, 14, 31);

    const body = res.lineas.map(l => [
      l.qty,
      l.rol,
      l.turno,
      l.horasPorPersona.toFixed(1),
      `$ ${l.precioUnitarioHora.toFixed(2)}`,
      `$ ${l.total.toFixed(2)}`,
      "MXN"
    ]);

    autoTable(doc, {
      head: [["Qty", "Producto", "Servicio", "Hrs/persona", "U. Price", "Total", "Moneda"]],
      body,
      startY: 36
    });

    const finalY = (doc as any).lastAutoTable.finalY || 36;
    doc.text(`Total por día: $ ${res.totalDia.toFixed(2)} MXN`, 14, finalY + 10);
    doc.text(`Total semanal: $ ${res.totalSemana.toFixed(2)} MXN`, 14, finalY + 16);

    doc.save("Cotizacion_CleanWay.pdf");
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, Arial", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Cotizador Clean Way</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 16 }}>
        <label>Días de semana
          <select value={diasToLabel(dias)} onChange={e=> setDias(e.target.value === "Personalizado" ? "custom" : e.target.value)} style={{ width: "100%" }}>
            <option value="L-V">L-V</option>
            <option value="L-S">L-S</option>
            <option value="L-D">L-D</option>
            <option value="L,M,X,J,V">L,M,X,J,V</option>
            <option value="Personalizado">Personalizado</option>
          </select>
        </label>

        <label>¿Quokka provee insumos?
          <select value={insumosQuokka ? "si" : "no"} onChange={e=>setInsumosQuokka(e.target.value==="si")} style={{ width: "100%" }}>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </label>

        <div style={{ display: dias === "custom" ? "block" : "none" }}>
          <div style={{ fontSize: 12, color: "#444" }}>Selecciona días</div>
          {["L","M","X","J","V","S","D"].map(d => (
            <label key={d} style={{ marginRight: 8 }}>
              <input type="checkbox" checked={diasPers.includes(d)} onChange={()=>toggleDia(d)} /> {d}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Turnos y dotación por turno</h3>
        {shifts.map((s, i) => (
          <div key={i} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginBottom: 10, background: "#fff" }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 160px 160px 160px 160px 160px", gap: 12, alignItems: "center" }}>
              <label>
                <input type="checkbox" checked={s.enabled} onChange={e=>updateShift(i,{enabled: e.target.checked})}/> {s.label}
              </label>
              <label>Entrada
                <input type="time" value={s.horaEntrada} onChange={e=>updateShift(i,{horaEntrada: e.target.value})} style={{ width: "100%" }}/>
              </label>
              <label>Salida
                <input type="time" value={s.horaSalida} onChange={e=>updateShift(i,{horaSalida: e.target.value})} style={{ width: "100%" }}/>
              </label>
              <label>Auxiliares
                <input type="number" min={0} value={s.auxiliares} onChange={e=>updateShift(i,{auxiliares: Number(e.target.value)})} style={{ width: "100%" }}/>
              </label>
              <label>Supervisores
                <input type="number" min={0} value={s.supervisores} onChange={e=>updateShift(i,{supervisores: Number(e.target.value)})} style={{ width: "100%" }}/>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: 16, border: "1px solid #eee", borderRadius: 12, background:"#fff" }}>
        <h3>Desglose por línea</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", borderBottom:"1px solid #ddd", padding: 8 }}>Qty</th>
              <th style={{ textAlign:"left", borderBottom:"1px solid #ddd", padding: 8 }}>Rol</th>
              <th style={{ textAlign:"left", borderBottom:"1px solid #ddd", padding: 8 }}>Turno</th>
              <th style={{ textAlign:"right", borderBottom:"1px solid #ddd", padding: 8 }}>Hrs/persona</th>
              <th style={{ textAlign:"right", borderBottom:"1px solid #ddd", padding: 8 }}>U. Price</th>
              <th style={{ textAlign:"right", borderBottom:"1px solid #ddd", padding: 8 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {res.lineas.map((l, idx) => (
              <tr key={idx}>
                <td style={{ padding: 8 }}>{l.qty}</td>
                <td style={{ padding: 8 }}>{l.rol}</td>
                <td style={{ padding: 8 }}>{l.turno}</td>
                <td style={{ padding: 8, textAlign: "right" }}>{l.horasPorPersona.toFixed(1)}</td>
                <td style={{ padding: 8, textAlign: "right" }}>${l.precioUnitarioHora.toFixed(2)}</td>
                <td style={{ padding: 8, textAlign: "right" }}>${l.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12 }}>
          <b>Total por día:</b> ${res.totalDia.toFixed(2)} MXN &nbsp; | &nbsp; 
          <b>Total semanal:</b> ${res.totalSemana.toFixed(2)} MXN &nbsp; | &nbsp;
          <b>Precio hora promedio:</b> ${res.precioHoraPromedio.toFixed(2)}
        </div>

        {res.alertas.length > 0 && (
          <div style={{ color: "#b00", marginTop: 8 }}>
            <b>Alertas:</b> {res.alertas.join(" | ")}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={generarPDF} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #222", background: "#111", color: "#fff" }}>
          Generar PDF
        </button>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        <p>
          Políticas: Margen {(catalogs.politicas.MargenMin_CleanWay*100).toFixed(0)}% |
          Overhead {(catalogs.politicas["CostoAdministrativo%"]*100).toFixed(0)}% |
          Insumos {(((catalogs.politicas as any).FactorInsumosPct ?? 0.085)*100).toFixed(1)}%.
        </p>
        <p style={{ marginTop: 4 }}>
          Nota: "L-V" y "L,M,X,J,V" son equivalentes (5 días). Si necesitas otra combinación, usa "Personalizado".
        </p>
      </div>
    </div>
  );
}

