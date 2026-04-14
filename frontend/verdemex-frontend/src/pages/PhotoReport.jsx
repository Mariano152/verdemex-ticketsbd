import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import '../styles/PhotoReport.css';

// Función para formatear fechas como DD-MM-YYYY
const formatDateDMY = (dateStr) => {
  if (!dateStr || dateStr === 'Invalid Date') return '??-??-????';
  
  // Si viene en formato ISO (2026-03-20T06:00:00.000Z), extraer solo YYYY-MM-DD
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }
  
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
};

export default function PhotoReport({ companyId }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  // Calcular rango de fechas permitidas para el mes seleccionado (TODO EL MES)
  const getDateRange = () => {
    const firstDay = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month, 0).toISOString().split('T')[0];
    return { firstDay, lastDay };
  };

  const dateRange = getDateRange();

  // Cargar fotos cuando cambien año o mes
  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(
        `/api/companies/${companyId}/photos/${year}/${String(month).padStart(2, '0')}`
      );
      setPhotos(response.data.photos || []);
    } catch (err) {
      setError('Error al cargar fotos: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, [companyId, year, month]);

  useEffect(() => {
    if (companyId) {
      loadPhotos();
    }
  }, [companyId, loadPhotos]);

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      setError('❌ Solo se permiten imágenes (JPG, PNG, GIF)');
      return;
    }

    // Validar que la fecha esté en el mes/año seleccionado
    const [photoYear, photoMonth] = selectedDate.split('-').map(Number);
    if (photoYear !== year || photoMonth !== month) {
      setError(`❌ La fecha debe estar en ${monthNames[month - 1]} de ${year}`);
      return;
    }

    // Intentar mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage({
        src: e.target.result,
        hasError: false
      });
    };
    reader.readAsDataURL(file);

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('photo_date', selectedDate);

      await api.post(
        `/api/companies/${companyId}/photos`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      setSuccess(`✅ Foto del ${formatDateDMY(selectedDate)} subida correctamente`);
      setPreviewImage(null);
      await loadPhotos();
      e.target.value = '';

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('❌ Error al subir foto: ' + (err.response?.data?.error || err.message));
      // Mostrar como card si hubo error
      setPreviewImage({
        src: null,
        hasError: true,
        date: selectedDate,
        filename: file.name
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta foto?')) return;

    try {
      await api.delete(`/api/companies/${companyId}/photos/${photoId}`);
      setSuccess('Foto eliminada correctamente');
      await loadPhotos();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error al eliminar foto: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleGeneratePDF = async () => {
    try {
      console.log(`🔄 [PDF] Iniciando descarga - Company: ${companyId}, ${year}-${String(month).padStart(2, '0')}`);
      setError('');
      setSuccess('⏳ Generando PDF...');

      const startTime = Date.now();
      console.log(`📤 [PDF] GET /api/companies/${companyId}/photos/report/${year}/${String(month).padStart(2, '0')}`);

      const response = await api.get(
        `/api/companies/${companyId}/photos/report/${year}/${String(month).padStart(2, '0')}`,
        { responseType: 'blob', timeout: 60000 } // 60 segundos timeout
      );

      const duration = Date.now() - startTime;
      console.log(`✅ [PDF] Respuesta recibida en ${duration}ms, size: ${response.data.size} bytes`);

      if (!response.data || response.data.size === 0) {
        console.error('❌ [PDF] PDF vacío recibido');
        setError('Error: PDF vacío generado');
        return;
      }

      console.log(`📥 [PDF] Creando objeto URL...`);
      const url = window.URL.createObjectURL(response.data);
      
      console.log(`📎 [PDF] Creando link de descarga...`);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-fotos-${year}-${String(month).padStart(2, '0')}.pdf`;
      document.body.appendChild(link);
      
      console.log(`⬇️  [PDF] Iniciando descarga...`);
      link.click();
      
      console.log(`🧹 [PDF] Limpiando recursos...`);
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log(`✅ [PDF] Descarga completada exitosamente`);
      setSuccess('✅ PDF descargado correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('❌ [PDF] ERROR:', {
        name: err.name,
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        errorData: err.response?.data,
        url: err.config?.url,
        timeout: err.code === 'ECONNABORTED' ? 'SÍ - TIMEOUT' : 'NO',
        fullError: err
      });

      let errorMsg = 'Error al generar PDF: ';
      if (err.code === 'ECONNABORTED') {
        errorMsg += 'Timeout - la solicitud tardó demasiado (>60s)';
      } else if (err.response?.status === 401) {
        errorMsg += 'No autorizado - sesión expirada';
      } else if (err.response?.status === 404) {
        errorMsg += 'No hay fotos para este mes';
      } else if (err.response?.status === 500) {
        errorMsg += 'Error en servidor: ' + (err.response?.data?.error || 'desconocido');
      } else if (err.message === 'Network Error') {
        errorMsg += 'Error de red - verifica conexión';
      } else {
        errorMsg += err.response?.data?.error || err.message;
      }

      setError(errorMsg);
      console.error('📋 [PDF] Mensaje mostrado:', errorMsg);
    }
  };

  const downloadPhoto = async (photoUrl, filename) => {
    try {
      const response = await api.get(photoUrl, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando foto:', error);
      alert('Error descargando la foto');
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const currentYear = new Date().getFullYear();
  const startYear = 2025; // Año mínimo disponible
  const endYear = currentYear + 2; // Año actual + 2
  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_, i) => endYear - i // Descendente para mejor UX
  );

  // Agrupar fotos por fecha
  const photosByDate = photos.reduce((acc, photo) => {
    if (!acc[photo.photo_date]) {
      acc[photo.photo_date] = [];
    }
    acc[photo.photo_date].push(photo);
    return acc;
  }, {});

  const sortedDates = Object.keys(photosByDate).sort();

  return (
    <div className="photo-report-container">
      <h2>📸 Reporte Fotográfico</h2>

      {/* Selector de mes y año */}
      <div className="date-selector">
        <div className="selector-group">
          <label htmlFor="month">Mes:</label>
          <select
            id="month"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
          >
            {monthNames.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="selector-group">
          <label htmlFor="year">Año:</label>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn-primary"
          onClick={handleGeneratePDF}
          disabled={sortedDates.length === 0 || loading}
        >
          📄 Descargar PDF
        </button>
      </div>

      {/* Selector de fecha para subir */}
      <div className="upload-section">
        <h4 style={{ marginTop: 0, marginBottom: 15, color: '#333' }}>📤 Subir nueva foto</h4>
        <div className="upload-controls">
          <div className="upload-group">
            <label htmlFor="photo-date">
              Fecha de la foto ({monthNames[month - 1]} {year}):
            </label>
            <input
              id="photo-date"
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              min={dateRange.firstDay}
              max={dateRange.lastDay}
            />
          </div>

          <div className="upload-group">
            <label htmlFor="photo-input">Seleccionar archivo (JPG, PNG, GIF):</label>
            <input
              id="photo-input"
              type="file"
              accept="image/jpeg,image/png,image/gif"
              onChange={handlePhotoUpload}
              disabled={uploading}
            />
          </div>
        </div>

        {previewImage && (
          <div className="preview-section">
            <p style={{ margin: '10px 0 5px 0', fontSize: '12px', fontWeight: '500', color: '#666' }}>
              📷 Vista previa:
            </p>
            {previewImage.src && !previewImage.hasError ? (
              <img 
                src={previewImage.src} 
                alt="Preview" 
                style={{ 
                  maxHeight: '150px', 
                  borderRadius: '6px',
                  border: '2px solid #4CAF50'
                }} 
              />
            ) : (
              <div className="preview-card">
                <div className="preview-card-date">📅 {formatDateDMY(previewImage.date || selectedDate)}</div>
                <div className="preview-card-filename">{previewImage.filename || 'Archivo'}</div>
              </div>
            )}
          </div>
        )}

        {uploading && <p className="loading">⏳ Subiendo foto...</p>}
      </div>

      {/* Mensajes */}
      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {/* Galería de fotos */}
      <div className="gallery-section">
        {loading ? (
          <p className="loading">Cargando fotos...</p>
        ) : sortedDates.length === 0 ? (
          <p className="no-photos">No hay fotos para {monthNames[month - 1]} de {year}</p>
        ) : (
          <div className="gallery">
            {sortedDates.map((date) => {
              // Validar que la fecha sea válida
              if (!date || date === 'Invalid Date') return null;
              
              return (
                <div key={date} className="photos-grid">
                  {photosByDate[date].map((photo) => (
                    <div 
                      key={photo.id} 
                      className="photo-card"
                      title="Foto del reporte"
                    >
                      {/* Imagen de la foto */}
                      <img 
                        src={photo.viewUrl} 
                        alt={`Foto del ${formatDateDMY(date)}`}
                        className="photo-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      
                      {/* Botón de descarga */}
                      <button
                        className="btn-download-photo"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPhoto(photo.downloadUrl, photo.filename);
                        }}
                        title="Descargar esta foto"
                      >
                        📥
                      </button>
                      
                      {/* Botón de eliminar */}
                      <button
                        className="btn-delete-photo"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photo.id);
                        }}
                        title="Eliminar esta foto"
                      >
                        ✕
                      </button>
                      
                      <div className="photo-info">
                        <div className="photo-date">📅 {formatDateDMY(date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
