# Migración: Agregar Company ID a Archivos

## Descripción
Este documento explica cómo migrar los archivos existentes para que estén asociados a una empresa (en este caso, la Planta Tonala con `company_id = 1`).

## Cambios realizados:

### 1. **Base de Datos**
- Se agregó la columna `company_id` a la tabla `files` (referencia a `companies`)
- Se agregó la columna `created_by` a la tabla `files` (referencia a `users`)
- Todos los archivos existentes se migran a `company_id = 1`

### 2. **Backend**
- ✅ Las rutas ya existían y estaban preparadas:
  - `POST /api/generate-excel` → Guarda con `companyId`
  - `POST /api/excel-to-txt` → Guarda con `companyId`
  - `POST /api/excel-to-txt-zip` → Guarda con `companyId`
  - `GET /api/companies/:companyId/files` → Obtiene archivos de una empresa
  - `GET /api/companies/:companyId/files/type/:type` → Obtiene archivos por tipo

### 3. **Frontend**
Se actualizaron los componentes para enviar `companyId`:
- `GenerateExcel.jsx` → Env´ía `companyId` en la solicitud
- `GenerateTicketsTxt.jsx` → Envía `companyId` en FormData
- `PreviousMovements.jsx` → Obtiene archivos de la empresa actual

## Pasos para ejecutar la migración:

### Opción A: SQL directo (si tienes acceso a la BD)
```sql
-- Ejecuta el SQL en tu cliente de BD (pgAdmin, DBeaver, etc.)
-- Archivo: backend/migrations/001_add_company_id_to_files.sql

-- 1. Agregar columnas si no existen
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE files 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 2. Migrar archivos existentes a company_id = 1
UPDATE files 
SET company_id = 1 
WHERE company_id IS NULL;

-- 3. Verificar (opcional)
SELECT COUNT(*) as total_files, COUNT(DISTINCT company_id) as companies_with_files 
FROM files;
```

### Opción B: Desde Node.js (recomendado para Render)
Si usas Render o similar, ejecuta:

```javascript
// En el backend, en backend/src/database.js o un script separado
const pool = require('./path/to/db/connection');

async function runMigration() {
  try {
    console.log('Iniciando migración...');
    
    // Agregar columnas
    await pool.query(`
      ALTER TABLE files 
      ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
    `);
    
    await pool.query(`
      ALTER TABLE files 
      ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);
    
    // Migrar datos
    await pool.query(`
      UPDATE files 
      SET company_id = 1 
      WHERE company_id IS NULL;
    `);
    
    // Verificar
    const result = await pool.query(`
      SELECT COUNT(*) as total_files, COUNT(DISTINCT company_id) as companies_with_files 
      FROM files;
    `);
    
    console.log('✅ Migración completada:', result.rows[0]);
  } catch (err) {
    console.error('❌ Error en migración:', err);
  }
}

runMigration();
```

## Verificación post-migración

Verifica que todo funcionó correctamente:

```sql
-- Verificar que colu1mnas existen
\d files

-- Verificar que los archivos tienen company_id
SELECT id, name, type, company_id, created_at 
FROM files 
ORDER BY created_at DESC 
LIMIT 10;

-- Verificar conteo por empresa
SELECT company_id, COUNT(*) as count 
FROM files 
WHERE company_id IS NOT NULL 
GROUP BY company_id;
```

## Estructura final

Después de la migración, los archivos estarán organizados así:
```
Planta Tonala (company_id = 1)
├── Reportes Excel (.xlsx)
├── Tickets TXT (.txt)
└── Zips de tickets (.zip)
```

## Notas:
- Los archivos si

n `company_id` se asignarán automáticamente a la empresa 1
- Nuevos archivos generados se guardarán siempre con el `companyId` de la empresa actual
- Cada usuario verá solo los archivos de las empresas a las que pertenece
- El histórico de archivos está disponible en la pestaña "Movimientos Anteriores"
