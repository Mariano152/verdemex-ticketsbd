import { useEffect, useState } from "react";
import api from "../api";
import { getDefaultConfig, loadLocalConfig } from "../storage";

export default function GenerateExcel({ companyId }) {
  const [config, setConfig] = useState(getDefaultConfig());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lastTicketNumber, setLastTicketNumber] = useState("");
  const [lastTicketDate, setLastTicketDate] = useState("");
  const [spacingVariance, setSpacingVariance] = useState(8);
  const [spacingVarianceRange, setSpacingVarianceRange] = useState(2);
  const [dailyTicketCount, setDailyTicketCount] = useState(80);
  const [dailyTicketCountRange, setDailyTicketCountRange] = useState(10);
  const [precioPorTon, setPrecioPorTon] = useState(520.33);
  const [holidayDates, setHolidayDates] = useState([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = loadLocalConfig();
    if (saved) {
      setConfig(saved);
      if (saved.company?.precioPorTon) setPrecioPorTon(saved.company.precioPorTon);
    }
  }, []);

  const generate = async () => {
    if (!startDate || !endDate) return alert("Falta fecha inicio/fin");
    
    // ✅ Validación: Fecha fin debe ser >= Fecha inicio
    if (endDate < startDate) {
      return alert("❌ Selecciona fecha correcta: La fecha fin debe ser después de la fecha inicio");
    }
    
    if (!lastTicketNumber) return alert("Falta último ticket registrado");
    if (!lastTicketDate) return alert("Falta fecha del último ticket");
    
    // ✅ Validación: Fecha del último ticket debe ser < Fecha inicio
    if (lastTicketDate >= startDate) {
      return alert("❌ Seleccione bien su fecha: El último ticket debe ser ANTES de la fecha inicio del reporte");
    }
    
    if (!spacingVariance) return alert("Falta espaciado entre tickets");
    if (!dailyTicketCount) return alert("Falta cantidad de tickets por día");
    if (!config.drivers || config.drivers.length === 0) {
      return alert("No hay conductores. Ve a Conductores y agrega.");
    }

    setLoading(true);
    try {
      const payload = {
        startDate,
        endDate,
        lastTicketNumber: Number(lastTicketNumber),
        lastTicketDate,
        spacingVariance: Number(spacingVariance),
        spacingVarianceRange: Number(spacingVarianceRange),
        dailyTicketCount: Number(dailyTicketCount),
        dailyTicketCountRange: Number(dailyTicketCountRange),
        config: {
          ...config,
          company: { ...(config.company || {}), precioPorTon: Number(precioPorTon) },
        },
        holidayDates: holidayDates,
        companyId
      };

      // ✅ Ruta ÚNICA del backend
      const res = await api.post("/api/generate-excel", payload, { responseType: "blob" });

      // ✅ NUEVO: Sincronizar config actualizada desde header
      if (res.headers["x-updated-config"]) {
        try {
          const updatedConfig = JSON.parse(res.headers["x-updated-config"]);
          setConfig(updatedConfig);
          // Guardar en localStorage
          const { saveLocalConfig } = await import("../storage.js");
          saveLocalConfig(updatedConfig);
          console.log("✅ Config sincronizada: acumuladores de choferes actualizados");
        } catch (e) {
          console.warn("⚠️ No se pudo sincronizar config:", e.message);
        }
      }

      // Generar el nombre del archivo usando las fechas de los inputs
      const startDateFormatted = startDate.split('-').reverse().join('.'); // yyyy-mm-dd -> dd.mm.yyyy
      const endDateFormatted = endDate.split('-').reverse().join('.'); // yyyy-mm-dd -> dd.mm.yyyy
      const filename = `reporte_${startDateFormatted}-${endDateFormatted}.xlsx`;

      console.log('📄 Nombre generado desde inputs:', filename);

      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Error generando excel. Revisa consola y logs de Render.");
    } finally {
      setLoading(false);
    }
  };

  const addHolidayDate = () => {
    if (!newHolidayDate) return alert("Selecciona una fecha");
    if (holidayDates.includes(newHolidayDate)) {
      return alert("Esta fecha ya está en la lista");
    }
    setHolidayDates([...holidayDates, newHolidayDate]);
    setNewHolidayDate("");
  };

  const removeHolidayDate = (dateToRemove) => {
    setHolidayDates(holidayDates.filter(d => d !== dateToRemove));
  };

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h3 className="cardTitle">Generar Excel</h3>

      <div className="callout small muted" style={{ marginBottom: 12 }}>
        Este Excel se genera usando los conductores guardados en esta PC.
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <label className="label">
          <b>Fecha inicio</b>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>

        <label className="label">
          <b>Fecha fin</b>
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>

        <label className="label">
          <b>Último ticket registrado</b>
          <input className="input" type="number" value={lastTicketNumber} onChange={(e) => setLastTicketNumber(e.target.value)} />
        </label>

        <label className="label">
          <b>Fecha del último ticket</b>
          <input className="input" type="date" value={lastTicketDate} onChange={(e) => setLastTicketDate(e.target.value)} />
        </label>

        <label className="label">
          <b>Espaciado entre tickets (base)</b>
          <input className="input" type="number" value={spacingVariance} onChange={(e) => setSpacingVariance(e.target.value)} />
        </label>

        <label className="label">
          <b>Variación espaciado (±)</b>
          <input className="input" type="number" value={spacingVarianceRange} onChange={(e) => setSpacingVarianceRange(e.target.value)} />
        </label>

        <label className="label">
          <b>Tickets por día completo (base)</b>
          <input className="input" type="number" value={dailyTicketCount} onChange={(e) => setDailyTicketCount(e.target.value)} />
        </label>

        <label className="label">
          <b>Variación diaria (±)</b>
          <input className="input" type="number" value={dailyTicketCountRange} onChange={(e) => setDailyTicketCountRange(e.target.value)} />
        </label>

        <label className="label">
          <b>Precio por Ton</b>
          <input className="input" type="number" step="0.01" value={precioPorTon} onChange={(e) => setPrecioPorTon(e.target.value)} />
        </label>
      </div>

      {/* Sección Días Festivos */}
      <div style={{ marginTop: 16, padding: 12, backgroundColor: "#f9f9f9", borderRadius: 8 }}>
        <h4 style={{ marginTop: 0, marginBottom: 10 }}>📅 Días Festivos (Opcional)</h4>
        <p className="small muted" style={{ marginBottom: 10 }}>
          Los días festivos se tratan como domingos: la báscula sigue abierta pero no se genera fila.
        </p>
        
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10 }}>
          <label className="label" style={{ marginBottom: 0, flex: 1 }}>
            <b style={{ fontSize: "0.9em" }}>Agregar fecha</b>
            <input 
              className="input" 
              type="date" 
              value={newHolidayDate} 
              onChange={(e) => setNewHolidayDate(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </label>
          <button 
            className="btn btnPrimary" 
            onClick={addHolidayDate}
            style={{ padding: "8px 16px" }}
          >
            Agregar
          </button>
        </div>

        {holidayDates.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {holidayDates.map((date) => (
              <div 
                key={date}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  backgroundColor: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: 4
                }}
              >
                <span>{date}</span>
                <button
                  onClick={() => removeHolidayDate(date)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#d32f2f",
                    fontSize: "1.2em",
                    padding: 0,
                    lineHeight: 1
                  }}
                  title="Remover"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btnPrimary" onClick={generate} disabled={loading}>
          {loading ? "Generando..." : "Generar Excel"}
        </button>

        <div className="small muted">
          Conductores cargados: <b>{config.drivers?.length || 0}</b>
        </div>
      </div>
    </div>
  );
}
