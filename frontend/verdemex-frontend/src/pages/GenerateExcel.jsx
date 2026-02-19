import { useEffect, useState } from "react";
import { api } from "../api";
import { getDefaultConfig, loadLocalConfig } from "../storage";

export default function GenerateExcel() {
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
    if (!lastTicketNumber) return alert("Falta último ticket registrado");
    if (!lastTicketDate) return alert("Falta fecha del último ticket");
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
      };

      // ✅ Ruta ÚNICA del backend
      const res = await api.post("/api/generate-excel", payload, { responseType: "blob" });

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
