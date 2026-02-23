import { useState } from "react";
import { api } from "../api";

export default function GenerateTicketsTxt() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zipMode, setZipMode] = useState(false);

  const downloadBlob = (blob, filename) => {
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

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const endpoint = zipMode ? "/api/excel-to-txt-zip" : "/api/excel-to-txt";

      const res = await api.post(endpoint, fd, {
        responseType: "blob",
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Intentar obtener el filename del header Content-Disposition
      let filename = null;
      const cd = res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition']);
      if (cd) {
        const m = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (m && m[1]) filename = m[1].replace(/['"]/g, '');
      }

      // Fallback: derivar nombre a partir del excel subido
      if (!filename && file && file.name) {
        // Normalizar: remover (1), (2), (n) que agrega el navegador
        let base = file.name.replace(/\.xlsx$/i, '');
        base = base.replace(/\s*\(\d+\)$/, ''); // Remover " (1)", " (2)", etc al final
        const ticketBase = base.replace(/^reporte_/, 'tickets_');
        const ext = zipMode ? 'zip' : 'txt';
        filename = `${ticketBase}.${ext}`;
      }

      // Último fallback
      if (!filename) filename = `tickets_${Date.now()}.${zipMode ? 'zip' : 'txt'}`;

      downloadBlob(res.data, filename);
    } catch (e) {
      console.error(e);
      alert("Error generando archivo. Revisa consola y logs de Render.");
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

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
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
