import React, { useEffect, useMemo, useState } from "react";
import catalogsRaw from "../../data/catalogs.cleanway.json";
import { cotizarCleanWay } from "../engine_cleanway";
import type { CleanWayInput, Catalogs, ShiftInput } from "../types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const catalogs = catalogsRaw as unknown as Catalogs;

const defaultShifts: ShiftInput[] = [
  { enabled: true,  label: "Primer",        horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Segundo",       horaEntrada: "14:00", horaSalida: "22:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Tercer",        horaEntrada: "22:00", horaSalida: "06:00", auxiliares: 0, supervisores: 0 },
  { enabled: false, label: "Personalizado", horaEntrada: "06:00", horaSalida: "14:00", auxiliares: 0, supervisores: 0 }
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
    // Equivalencia simple: L-V == L,M,X,J,V
    if (dias === "L-V") setDiasPers(["L","M","X","J","V"]);
  }, [dias]);

  const input: CleanWayInput = useMemo(()=>({
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

  async function generarPDF() {
    const doc = new jsPDF();

    // Logo más grande en PDF
    const LOGO_W = 56;   // ancho
    const LOGO_H = 28;   // alto

    try {
      const logoData = await fetch("/logo-cleanway.png")
        .then(r => r.ok ? r.blob() : Promise.reject())
        .then(b => new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }));
      doc.addImage(logoData, "PNG", 14, 10, LOGO_W, LOGO_H);
    } catch {
      // sin logo, seguimos
    }

    doc.setFontSize(16);
    doc.text("Cotizador Clean Way", 14 + LOGO_W + 10, 18);
    doc.setFontSize(10);
    doc.text(`Días efectivos por semana: ${res.diasEfectivosSemana}`, 14 + LOGO_W + 10, 24);
    doc.text(
      `Políticas: Margen ${(catalogs.politicas.MargenMin_CleanWay*100).toFixed(0)}% | Overhead ${(catalogs.politicas["CostoAdministrativo%"]*100).toFixed(0)}% | Insumos ${(((catalogs.politicas as any).FactorInsumosPct ?? 0.085)*100).toFixed(1)}%`,
      14,
      30
    );

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
      startY: 36,
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [238, 242, 247], textColor: 0 },  // gris claro
      alternateRowStyles: { fillColor: [243, 244, 246] }
    });

    const y = (doc as any).lastAutoTable.finalY || 36;
    doc.text(`Total por día: $ ${res.totalDia.toFixed(2)} MXN`, 14, y + 8);
    doc.text(`Total semanal: $ ${res.totalSemana.toFixed(2)} MXN`, 14, y + 14);
    doc.save("Cotizacion_CleanWay.pdf");
  }

  return (
    <div className="container">
      {/* HEADER con logo */}
      <div className="header">
        <img src="/logo-cleanway.png" alt="Clean Way" />
        <div>
          <h1>Cotizador Clean Way</h1>
          <div className="subtle">Parámetros de cotización</div>
        </div>
      </div>

      {/* Filtros: días e insumos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 16 }}>
        <label>Días de semana
          <select
            value={diasToLabel(dias)}
            onChange={e=> setDias(e.target.value === "Personalizado" ? "custom" : e.target.value)}
            style={{ width: "100%" }}
          >
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
          <div className="subtle">Selecciona días</div>
          {["L","M","X","J","V","S","D"].map(d => (
            <label key={d} style={{ marginRight: 8 }}>
              <input type="checkbox" checked={diasPers.includes(d)} onChange={()=>toggleDia(d)} /> {d}
            </label>
          ))}
        </div>
      </div>

      {/* Turnos y dotación */}
      <div style={{ marginTop: 24 }}>
        <h3>Turnos y dotación por turno</h3>
        {shifts.map((s, i) => (
          <div key={i} className="card" style={{ marginBottom: 10 }}>
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

      {/* Desglose en tabla */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Desglose por línea</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Qty</th>
              <th>Rol</th>
              <th>Turno</th>
              <th className="num">Hrs/persona</th>
              <th className="num">U. Price</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {res.lineas.map((l, idx) => (
              <tr key={idx}>
                <td>{l.qty}</td>
                <td>{l.rol}</td>
                <td><span className="chip">{l.turno}</span></td>
                <td className="num">{l.horasPorPersona.toFixed(1)}</td>
                <td className="num">${l.precioUnitarioHora.toFixed(2)}</td>
                <td className="num">${l.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12, fontWeight: 600 }}>
          Total por día: ${res.totalDia.toFixed(2)} MXN &nbsp; | &nbsp;
          Total semanal: ${res.totalSemana.toFixed(2)} MXN &nbsp; | &nbsp;
          Precio hora promedio: ${res.precioHoraPromedio.toFixed(2)}
        </div>

        {res.alertas.length > 0 && (
          <div style={{ color: "#b00", marginTop: 8 }}>
            <b>Alertas:</b> {res.alertas.join(" | ")}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => generarPDF()}>Generar PDF</button>
      </div>

      <div className="subtle" style={{ marginTop: 12 }}>
        Políticas: Margen {(catalogs.politicas.MargenMin_CleanWay*100).toFixed(0)}% ·
        Overhead {(catalogs.politicas["CostoAdministrativo%"]*100).toFixed(0)}% ·
        Insumos {(((catalogs.politicas as any).FactorInsumosPct ?? 0.085)*100).toFixed(1)}%.
      </div>
    </div>
  );
}
