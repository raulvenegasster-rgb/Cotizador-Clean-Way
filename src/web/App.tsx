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
    <div className="container">
      {/* HEADER con logo */}
      <div className="header">
        <img src="/logo-cleanway.png" alt="Clean Way" />
        <div>
          <h1 style={{margin:0}}>Cotizador Clean Way</h1>
          <div className="subtle">Parámetros de cotización</div>
        </div>
      </div>

      {/* Filtros arriba (días e insumos) como ya los tienes */}
      {/* ... */}

      {/* Turnos y dotación (igual que ya lo tienes, puedes envolver cada turno en .card si quieres) */}
      {/* ... */}

      {/* DESGLOSE EN TABLA CON FORMATO */}
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
        <button className="btn" onClick={generarPDF}>Generar PDF</button>
      </div>

      <div className="subtle" style={{ marginTop: 12 }}>
        Políticas: Margen {(catalogs.politicas.MargenMin_CleanWay*100).toFixed(0)}% ·
        Overhead {(catalogs.politicas["CostoAdministrativo%"]*100).toFixed(0)}% ·
        Insumos {(((catalogs.politicas as any).FactorInsumosPct ?? 0.085)*100).toFixed(1)}%.
      </div>
    </div>
  );
}

