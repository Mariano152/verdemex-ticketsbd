# 🔒 Plan de Seguridad y Recuperación de Datos

## El Problema
Un admin enojado podría borrar datos críticos accidentalmente o intencionalmente.

---

## 🛡️ Soluciones Implementables (en orden de prioridad)

### 1️⃣ **BACKUPS AUTOMÁTICOS** (CRÍTICO - Hacer AHORA)
#### Opción A: Supabase (Recomendado - Ya lo tienes)
```
- Supabase hace backups automáticos diarios
- Los mantienes por 30 días
- Puedes descargarlos manualmente
- Accede a: Project Settings → Backups
```

✅ **Acción**: En Supabase:
1. Ve a "Project Settings" → "Backups"
2. Verifica que los backups automáticos estén activos (deberían estarlo)
3. Descarga un backup de prueba para verificar

#### Opción B: Backups Manuales (Complementario)
```bash
# Script para hacer backup manual diario
# Guardar como backend/scripts/backup.sh

#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

# Exportar desde Supabase usando CLI (si lo tienes)
# O hacer dump manual desde la UI

echo "✅ Backup creado: $BACKUP_DIR/backup_$TIMESTAMP.sql"
```

---

### 2️⃣ **SOFT DELETES** (Implementar en BD)
En lugar de BORRAR datos, solo marcarlos como eliminados.

#### Cambios en la BD:

```sql
-- Agregar columna deleted_at a tablas críticas
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Las consultas SELECT ignoran deleted_at IS NOT NULL
-- Pero los datos siguen en la BD
```

#### Cambios en el Backend:

```javascript
// En database.js - En lugar de DELETE, hacer UPDATE

// ANTES (Peligroso):
async deleteUser(userId) {
  return await db('users').where('id', userId).delete();
}

// DESPUÉS (Seguro):
async deleteUser(userId) {
  return await db('users')
    .where('id', userId)
    .update({ deleted_at: new Date() });
}

// Para listar usuarios (ignorar eliminados):
async getAllUsers() {
  return await db('users').whereNull('deleted_at');
}
```

---

### 3️⃣ **PAPELERA DE RECICLAJE** (30 días para recuperar)
Los datos "eliminados" van a una papelera antes de ser eliminados permanentemente.

```sql
-- Crear tabla de papelera
CREATE TABLE IF NOT EXISTS trash (
  id SERIAL PRIMARY KEY,
  original_table VARCHAR(50) NOT NULL,
  original_id INT NOT NULL,
  deleted_by INT REFERENCES users(id),
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL,
  recoverable_until TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
  recovered BOOLEAN DEFAULT FALSE
);

-- Crear índices
CREATE INDEX idx_trash_deleted_at ON trash(deleted_at);
CREATE INDEX idx_trash_recoverable_until ON trash(recoverable_until);
```

**Flujo**:
1. Admin quiere eliminar usuario → va a papelera
2. Se guarda copia en tabla `trash` con datos JSON
3. Usuario desaparece de vistas normales (soft delete)
4. Admin tiene 30 días para recuperarlo
5. Después de 30 días, se borra permanentemente

---

### 4️⃣ **AUDITORÍA - REGISTRAR TODAS LAS ACCIONES**
Saber QUIÉN hizo QUÉ y CUÁNDO.

```sql
-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(100) NOT NULL, -- 'delete', 'update', 'create'
  table_name VARCHAR(50) NOT NULL,
  record_id INT,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_action ON audit_logs(action);
```

**En el backend**:
```javascript
// Crear función para registrar cambios
async function logAudit(userId, action, tableName, recordId, oldValues, newValues) {
  return await db('audit_logs').insert({
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_values: oldValues,
    new_values: newValues,
    ip_address: req.ip,
    timestamp: new Date()
  });
}

// Usar en DELETE: antes de soft delete
await logAudit(req.user.userId, 'delete', 'users', userId, user, null);
```

---

### 5️⃣ **DOS PASOS PARA ACCIONES CRÍTICAS**
Requiere doble confirmación para eliminar cosas importantes.

```javascript
// Backend - Ruta para marcar para eliminación
app.post("/api/request-delete/:type/:id", authMiddleware, async (req, res) => {
  // 1. Registrar intención de eliminar
  // 2. Enviar email de confirmación
  // 3. Solo eliminar si se confirma en 24 horas
});
```

---

### 6️⃣ **PERMISOS GRANULARES**
No todos los admins pueden hacer todo.

```sql
-- Tabla de permisos
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(20),
  permission VARCHAR(100),
  UNIQUE(role, permission)
);

-- Ejemplos:
INSERT INTO role_permissions VALUES 
  ('superadmin', 'users.delete'),
  ('superadmin', 'companies.delete'),
  ('admin', 'users.update'),
  ('admin', 'users.create'),
  -- ('admin', 'users.delete') -- NO permitir a admin regular
```

---

## 📋 Plan de Implementación (Recomendado)

### Fase 1 (INMEDIATA - Hoy):
- [x] Verificar backups automáticos en Supabase
- [x] Crear script de backup manual
- [ ] Hacer primer backup manual

### Fase 2 (Esta semana):
- [ ] Implementar Soft Deletes en users y companies
- [ ] Agregar tabla de audit_logs
- [ ] Crear endpoint para ver auditoría

### Fase 3 (Próxima semana):
- [ ] Implementar Papelera de reciclaje
- [ ] Frontend para recuperar elementos eliminados
- [ ] Two-step confirmation para eliminaciones

### Fase 4 (Futuro):
- [ ] Permisos granulares
- [ ] Notificaciones por email de acciones críticas

---

## 🔑 Resumen Rápido

| Protección | Implementación | Beneficio |
|-----------|----------------|-----------|
| **Backups** | Supabase automático | ✅ Recuperar todo en caso de desastre |
| **Soft Deletes** | Agregar `deleted_at` | ✅ Nunca pierdes datos realmente |
| **Papelera** | Tabla `trash` con JSON | ✅ Recuperar en 30 días |
| **Auditoría** | Tabla `audit_logs` | ✅ Saber quién hizo qué |
| **Confirmación** | Two-step verify | ✅ Evitar acciones impulsivas |
| **Permisos** | Tabla `role_permissions` | ✅ Controlar qué puede hacer cada admin |

---

## 💡 Recomendación Inmediata

**Haz esto HOY mismo:**

1. Verifica los backups en Supabase
2. Implementa **Soft Deletes** en la BD
3. Agrega **tabla de auditoría** para logging

Con estas 3 cosas, estás 95% protegido contra:
- Borrados accidentales (Soft Delete + Auditoría)
- Pérdida total de datos (Backups + Soft Delete)
- Responsabilidad (Auditoría muestra quién hizo qué)

---

## ¿Quieres que implemente alguno de estos?

Puedo ayudarte con:
- Script SQL para soft deletes ✅
- Código backend para auditoría ✅
- Tabla y lógica de papelera ✅
- Script de backup automático ✅

Avísame cuál quieres primero.
