-- ===== MIGRACIÓN: AGREGAR SOFT DELETES A TODAS LAS TABLAS =====
-- Fecha: 2026-04-01
-- Propósito: Implementar soft deletes (deleted_at) para recuperación de datos

-- 1. Agregar deleted_at a tabla users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- 2. Agregar deleted_at a tabla companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- 3. Agregar deleted_at a tabla files
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- 4. Agregar deleted_at a tabla company_members
ALTER TABLE company_members 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- 5. Crear índices para mejorar performance de queries con deleted_at
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON companies(deleted_at);
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at);
CREATE INDEX IF NOT EXISTS idx_company_members_deleted_at ON company_members(deleted_at);

-- 7. Crear índices compuestos para operaciones comunes
CREATE INDEX IF NOT EXISTS idx_users_deleted_active ON users(id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_companies_deleted_active ON companies(id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_files_deleted_active ON files(id, deleted_at);

-- Confirmación
SELECT 'Migración 003 completada: Soft deletes agregados a todas las tablas' as status;
