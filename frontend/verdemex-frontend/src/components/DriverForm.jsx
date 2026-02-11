import { useState } from "react";

const emptyDriver = {
  nombre: "",
  placas: "",
  taraKg: "",
  horariosText: "6-8",
  ticketsPorDia: 1,
  pesoBaseTon: "",
  variacionPct: "",
  activo: true,
};

function buildFormFromDriver(driver) {
  if (!driver) return { ...emptyDriver };

  return {
    nombre: driver.nombre || "",
    placas: driver.placas || "",
    taraKg: String(driver.taraKg ?? ""),
    horariosText: (driver.horarios || []).join(",") || "6-8",
    ticketsPorDia: Number(driver.ticketsPorDia ?? 1),
    pesoBaseTon: String(driver.pesoBaseTon ?? ""),
    variacionPct: String(driver.variacionPct ?? ""),
    activo: Boolean(driver.activo ?? true),
  };
}

export default function DriverForm({
  mode = "create",
  initialValue,
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(() =>
    mode === "edit" ? buildFormFromDriver(initialValue) : { ...emptyDriver }
  );

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const validate = () => {
    const nombre = form.nombre.trim();
    const placas = form.placas.trim();
    const taraKg = Number(form.taraKg);
    const ticketsPorDia = Number(form.ticketsPorDia);
    const pesoBaseTon = Number(form.pesoBaseTon);
    const variacionPct = Number(form.variacionPct);

    const horarios = form.horariosText
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (!nombre) return "Falta nombre";
    if (!placas) return "Falta placas";
    if (!Number.isFinite(taraKg) || taraKg <= 0) return "TaraKg inválida";
    if (!Number.isFinite(ticketsPorDia) || ticketsPorDia <= 0)
      return "TicketsPorDia inválido";
    if (!Number.isFinite(pesoBaseTon) || pesoBaseTon <= 0)
      return "Peso base (ton) inválido";
    if (!Number.isFinite(variacionPct) || variacionPct < 0)
      return "Variación % inválida";
    if (!horarios.length) return "Debes poner al menos 1 horario";

    return null;
  };

  const submit = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return alert(err);

    const payload = {
      ...(mode === "edit" && initialValue ? initialValue : {}),
      nombre: form.nombre.trim().toUpperCase(),
      placas: form.placas.trim().toUpperCase(),
      taraKg: Number(form.taraKg),
      horarios: form.horariosText
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      ticketsPorDia: Number(form.ticketsPorDia),
      pesoBaseTon: Number(form.pesoBaseTon),
      variacionPct: Number(form.variacionPct),
      activo: Boolean(form.activo),
    };

    onSave(payload);

    if (mode === "create") setForm({ ...emptyDriver });
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="label">
          <b>Nombre</b>
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setField("nombre", e.target.value)}
          />
        </label>

        <label className="label">
          <b>Placas</b>
          <input
            className="input"
            value={form.placas}
            onChange={(e) => setField("placas", e.target.value)}
          />
        </label>

        <label className="label">
          <b>Tara (KG)</b>
          <input
            className="input"
            type="number"
            value={form.taraKg}
            onChange={(e) => setField("taraKg", e.target.value)}
          />
        </label>

        <label className="label">
          <b>Tickets por día</b>
          <input
            className="input"
            type="number"
            value={form.ticketsPorDia}
            onChange={(e) => setField("ticketsPorDia", e.target.value)}
          />
        </label>

        <label className="label">
          <b>Peso base (Ton)</b>
          <input
            className="input"
            type="number"
            step="0.001"
            value={form.pesoBaseTon}
            onChange={(e) => setField("pesoBaseTon", e.target.value)}
          />
        </label>

        <label className="label">
          <b>Variación ± (%)</b>
          <input
            className="input"
            type="number"
            step="0.01"
            value={form.variacionPct}
            onChange={(e) => setField("variacionPct", e.target.value)}
          />
        </label>

        <label className="label" style={{ gridColumn: "1 / -1" }}>
          <b>Horarios (coma) ej: 6-8,12-15</b>
          <input
            className="input"
            value={form.horariosText}
            onChange={(e) => setField("horariosText", e.target.value)}
          />
        </label>

        <label className="label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setField("activo", e.target.checked)}
          />
          <b>Activo</b>
        </label>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btnPrimary" type="submit">
          {mode === "edit" ? "Guardar cambios" : "Agregar"}
        </button>
        {mode === "edit" && (
          <button className="btn btnGhost" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
