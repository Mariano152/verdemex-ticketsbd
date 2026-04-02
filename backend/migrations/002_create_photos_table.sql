-- Migración: Crear tabla para fotos del reporte mensual

CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  photo_date DATE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  path TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_photos_company_date ON photos(company_id, photo_date);
CREATE INDEX IF NOT EXISTS idx_photos_company_month ON photos(company_id, EXTRACT(YEAR FROM photo_date), EXTRACT(MONTH FROM photo_date));

-- Comentarios
COMMENT ON TABLE photos IS 'Almacena fotos para reportes mensuales por empresa. is_deleted marca como eliminada pero mantiene el registro.';
