import { useMemo, useState, useEffect } from "react";
import DriverForm from "../components/DriverForm";
import { getDefaultConfig, loadLocalConfig, saveLocalConfig } from "../storage";

function makeId() {
  return "driver_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
}

function normalizeConfig(cfg) {
  const base = getDefaultConfig();
  const merged = cfg && typeof cfg === "object" ? { ...base, ...cfg } : base;
  return {
    ...merged,
    drivers: Array.isArray(merged.drivers) ? merged.drivers : [],
  };
}

export default function Drivers() {
  const [config, setConfig] = useState(() => {
    const saved = loadLocalConfig();
    return normalizeConfig(saved);
  });

  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    saveLocalConfig(config);
  }, [config]);

  const drivers = config.drivers;

  const editingDriver = useMemo(
    () => drivers.find((d) => d.id === editingId) || null,
    [drivers, editingId]
  );

  const addDriver = (d) => {
    setConfig((prev) => ({
      ...prev,
      drivers: [...prev.drivers, { ...d, id: makeId() }],
    }));
  };

  const updateDriver = (updated) => {
    setConfig((prev) => ({
      ...prev,
      drivers: prev.drivers.map((d) => (d.id === updated.id ? updated : d)),
    }));
    setEditingId(null);
  };

  const removeDriver = (id) => {
    if (!confirm("¿Eliminar este conductor?")) return;
    setConfig((prev) => ({
      ...prev,
      drivers: prev.drivers.filter((d) => d.id !== id),
    }));
    if (editingId === id) setEditingId(null);
  };

  const toggleActive = (id) => {
    setConfig((prev) => ({
      ...prev,
      drivers: prev.drivers.map((d) =>
        d.id === id ? { ...d, activo: !d.activo } : d
      ),
    }));
  };

  const resetAll = () => {
    if (!confirm("¿Borrar TODOS los conductores y volver a vacío?")) return;
    setConfig((prev) => ({ ...prev, drivers: [] }));
    setEditingId(null);
  };

  return (
    <div className="grid2">
      <div className="card">
        <h3 className="cardTitle">Alta de conductores</h3>
        <DriverForm mode="create" onSave={addDriver} />

        <div className="hr" />

        <button className="btn btnDanger" onClick={resetAll}>
          Reset conductores
        </button>

        <div className="callout" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, color: "#0b4a24", marginBottom: 6 }}>
            Guardado automático
          </div>
          <div className="small muted">
            Se guarda en esta PC (localStorage). Si apagas/prendes la PC, se
            conserva. Si abres en otra computadora/navegador, será otra lista.
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <h3 className="cardTitle" style={{ margin: 0 }}>Conductores</h3>
          <span className="badge">{drivers.length} registrados</span>
        </div>

        <div className="hr" />

        {drivers.length === 0 ? (
          <p className="muted">No hay conductores.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {drivers.map((d) => (
              <div key={d.id} className="rowCard">
                <div>
                  <div style={{ fontWeight: 900, fontSize: 14 }}>
                    {d.nombre} — {d.placas}{" "}
                    {!d.activo && (
                      <span
                        className="badge"
                        style={{
                          marginLeft: 8,
                          background: "rgba(239,68,68,.10)",
                          borderColor: "rgba(239,68,68,.25)",
                          color: "#b91c1c",
                        }}
                      >
                        INACTIVO
                      </span>
                    )}
                  </div>

                  <div className="small muted" style={{ marginTop: 4 }}>
                    TaraKg: <b>{d.taraKg}</b> • Horarios:{" "}
                    <b>{(d.horarios || []).join(", ")}</b> • Tickets/día:{" "}
                    <b>{d.ticketsPorDia}</b>
                  </div>

                  <div className="small muted" style={{ marginTop: 2 }}>
                    BaseTon: <b>{d.pesoBaseTon}</b> • ±<b>{d.variacionPct}%</b>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button className="btn btnGhost" onClick={() => setEditingId(d.id)}>
                    Editar
                  </button>
                  <button className="btn btnGhost" onClick={() => toggleActive(d.id)}>
                    {d.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button className="btn btnDanger" onClick={() => removeDriver(d.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editingDriver && (
          <div style={{ marginTop: 14 }}>
            <div className="hr" />
            <h3 className="cardTitle" style={{ marginTop: 0 }}>Editar</h3>
            <DriverForm
              key={editingDriver.id}  // ✅ esto refresca el form sin useEffect
              mode="edit"
              initialValue={editingDriver}
              onSave={updateDriver}
              onCancel={() => setEditingId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
