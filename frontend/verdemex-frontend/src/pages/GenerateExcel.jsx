import { useEffect, useState } from "react";
import { api } from "../api";
import { getDefaultConfig, loadLocalConfig } from "../storage";

export default function GenerateExcel() {
  const [config, setConfig] = useState(getDefaultConfig());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ticketInicial, setTicketInicial] = useState("");
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
    if (!ticketInicial) return alert("Falta ticket inicial");
    if (!config.drivers || config.drivers.length === 0) {
      return alert("No hay conductores. Ve a Conductores y agrega.");
    }

    setLoading(true);
    try {
      const payload = {
        startDate,
        endDate,
        ticketInicial: Number(ticketInicial),
        config: {
          ...config,
          company: { ...(config.company || {}), precioPorTon: Number(precioPorTon) },
        },
      };

      // ✅ Ruta ÚNICA del backend
      const res = await api.post("/api/generate-excel", payload, { responseType: "blob" });

      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reporte.xlsx";
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
          <b>Ticket inicial</b>
          <input className="input" type="number" value={ticketInicial} onChange={(e) => setTicketInicial(e.target.value)} />
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
