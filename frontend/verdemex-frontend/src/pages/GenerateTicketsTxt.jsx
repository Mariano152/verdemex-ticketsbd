import { useState } from "react";

export default function GenerateTicketsTxt() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zipMode, setZipMode] = useState(false);

  const downloadBlob = async (res, filename) => {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!file) return alert("Sube un Excel primero.");

    const base = import.meta.env.VITE_API_URL;
    if (!base) return alert("Falta VITE_API_URL. Revisa tu .env o variables de Vercel.");

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const endpoint = zipMode
        ? `${base}/api/excel-to-txt-zip`
        : `${base}/api/excel-to-txt`;

      const res = await fetch(endpoint, { method: "POST", body: fd });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error generando archivo");
      }

      const ext = zipMode ? "zip" : "txt";
      await downloadBlob(res, `tickets_${Date.now()}.${ext}`);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 820 }}>
      <h3 className="cardTitle">Generar Tickets desde Excel</h3>

      <div className="callout small muted" style={{ marginBottom: 12 }}>
        Sube un Excel y se genera el TXT con el formato del ticket (o ZIP si quieres 1 txt por ticket).
      </div>

      <label className="label">
        <b>Excel (.xlsx)</b>
        <input
          className="input"
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>

      {file && (
        <div className="small muted" style={{ marginTop: 10 }}>
          Archivo: <b>{file.name}</b>
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label className="badge" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={zipMode}
            onChange={(e) => setZipMode(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          1 ticket por TXT (descargar ZIP)
        </label>

        <button className="btn btnPrimary" onClick={submit} disabled={loading}>
          {loading ? "Generando..." : zipMode ? "Generar ZIP" : "Generar TXT"}
        </button>
      </div>

      <p className="small muted" style={{ marginTop: 10 }}>
        * En modo ZIP: se crea un archivo .txt por ticket (ej: <b>TKT_30216_JU89286.txt</b>)
      </p>
    </div>
  );
}
