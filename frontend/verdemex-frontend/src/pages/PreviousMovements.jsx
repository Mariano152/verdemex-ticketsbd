import { useEffect, useState } from "react";
import { api } from "../api";

export default function PreviousMovements() {
  const [activeTab, setActiveTab] = useState("excel");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tabs = [
    { key: "excel", label: "📊 Excel", icon: "📊" },
    { key: "txt", label: "📄 TXT", icon: "📄" },
    { key: "zip", label: "📦 ZIP", icon: "📦" },
  ];

  // Cargar archivos cuando cambia la pestaña
  useEffect(() => {
    loadFiles();
  }, [activeTab]);

  const loadFiles = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/api/files/type/${activeTab}`);
      setFiles(res.data.files || []);
    } catch (err) {
      console.error(err);
      setError("Error cargando archivos");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (fileId, fileName) => {
    try {
      const res = await api.get(`/api/files/download/${fileId}`, {
        responseType: "blob",
      });
      
      // Crear un URL blob y descargar
      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error descargando archivo");
    }
  };

  const deleteFile = async (fileId, fileName) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${fileName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await api.delete(`/api/files/${fileId}`);
      alert("Archivo eliminado correctamente");
      loadFiles(); // Recargar la lista
    } catch (err) {
      console.error(err);
      alert("Error eliminando archivo");
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="card" style={{ maxWidth: 900 }}>
      <h3 className="cardTitle">📋 Movimientos Anteriores</h3>

      {/* Pestañas */}
      <div className="tabsContainer" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid #e0e0e0", paddingBottom: "12px" }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 16px",
                border: "none",
                background: activeTab === tab.key ? "#4CAF50" : "transparent",
                color: activeTab === tab.key ? "white" : "#666",
                borderRadius: "6px 6px 0 0",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "all 0.3s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
          ⏳ Cargando archivos...
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#d32f2f" }}>
          ❌ {error}
        </div>
      ) : files.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
          📭 No hay {activeTab === "excel" ? "excels" : activeTab === "txt" ? "txts" : "zips"} generados
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {files.map((file) => (
            <div
              key={file.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                backgroundColor: "#fafafa",
                hover: { backgroundColor: "#f5f5f5" },
                transition: "all 0.2s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f5f5f5";
                e.currentTarget.style.borderColor = "#4CAF50";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fafafa";
                e.currentTarget.style.borderColor = "#e0e0e0";
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "600", color: "#333", marginBottom: "6px" }}>
                  {file.name}
                </div>
                <div style={{ fontSize: "12px", color: "#999" }}>
                  📅 {formatDate(file.created_at)}
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => downloadFile(file.id, file.name)}
                  style={{
                    padding: "10px 20px",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background 0.3s ease",
                  }}
                  onMouseEnter={(e) => (e.target.style.background = "#45a049")}
                  onMouseLeave={(e) => (e.target.style.background = "#4CAF50")}
                >
                  ⬇️ Descargar
                </button>
                <button
                  onClick={() => deleteFile(file.id, file.name)}
                  style={{
                    padding: "10px 20px",
                    background: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "background 0.3s ease",
                  }}
                  onMouseEnter={(e) => (e.target.style.background = "#da190b")}
                  onMouseLeave={(e) => (e.target.style.background = "#f44336")}
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
