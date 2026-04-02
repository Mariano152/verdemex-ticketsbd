-- Migración: Agregar company_id a la tabla files y migrar archivos existentes a company_id = 1

-- 1. Agregar columna company_id a files (si no existe)
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Agregar columna created_by a files (si no existe)
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 3. Actualizar todos los archivos existentes sin company_id a company_id = 1 (Planta Tonala)
UPDATE files 
SET company_id = 1 
WHERE company_id IS NULL;

-- 4. Hacer company_id NOT NULL (opcional, después de asegurar que no hay NULLs)
-- ALTER TABLE files ALTER COLUMN company_id SET NOT NULL;

-- Verificar que la migración se ejecutó correctamente
SELECT COUNT(*) as total_files, COUNT(DISTINCT company_id) as companies_with_files 
FROM files;
