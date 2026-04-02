# 📋 SOFT DELETES - GUÍA DE IMPLEMENTACIÓN Y RECUPERACIÓN

## ✅ Cambios realizados

### 1. **Migración SQL creada** → `003_add_soft_deletes.sql`
Agrega columna `deleted_at` a:
- `users`
- `companies`
- `files`
- `company_members`
- `photos` (ya tenía is_deleted, ahora también tiene deleted_at normalizado)

### 2. **Database.js actualizado** ✅
Todas las funciones ahora usan soft delete:

| Antes (Hard Delete) | Ahora (Soft Delete) |
|---|---|
| `DELETE FROM users` | `UPDATE users SET deleted_at = NOW()` |
| SELECT sin filtro | SELECT WHERE `deleted_at IS NULL` |
| Datos se pierden | Datos recuperables con query |

**Funciones cambiadas:**
- ✅ `deleteUser(userId)` → Soft delete
- ✅ `deleteCompany(companyId)` → Soft delete  
- ✅ `deleteFile(id)` / `deleteFileById(id)` → Soft delete
- ✅ `removeUserFromCompany(userId, companyId)` → Soft delete
- ✅ `getAllUsers()` → Solo muestra activos (WHERE deleted_at IS NULL)
- ✅ `getAllCompanies()` → Solo muestra activas (WHERE deleted_at IS NULL)
- ✅ `getFilesByCompany()` → Solo muestra activos (WHERE deleted_at IS NULL)
- ✅ `getFilesByCompanyAndType()` → Solo muestra activos (WHERE deleted_at IS NULL)
- ✅ `getCompaniesByUserId()` → Solo muestra activas (WHERE deleted_at IS NULL)
- ✅ `getCompanyMembers()` → Solo muestra activos (WHERE deleted_at IS NULL)

### 3. **Server.js - Sin cambios necesarios** ✅
Los endpoints DELETE siguen igual porque ya usan las funciones de database.js:
- `DELETE /api/admin/users/:userId` → usa `deleteUser()` ✅
- `DELETE /api/companies/:companyId` → usa `deleteCompany()` ✅
- `DELETE /api/files/:id` → usa `deleteFileById()` ✅
- `DELETE /api/companies/:companyId/members/:userId` → usa `removeUserFromCompany()` ✅

---

## 🚀 Pasos para activar

### **Paso 1: Ejecutar migración SQL en Supabase**

Ve a Supabase → SQL Editor y copia todo el contenido de:
```
backend/migrations/003_add_soft_deletes.sql
```

Y ejecuta. Verás:
```
INFO: migración 003 completada: Soft deletes agregados a todas las tablas
```

### **Paso 2: Reiniciar el backend**
```bash
cd backend
npm start
```

### **Paso 3: Verificar que funciona**

**Elimina un usuario desde el Admin Panel:**
1. Ve a "Panel Admin" → "Usuarios"
2. Clickea DELETE en cualquier usuario
3. El usuario desaparece del frontend ✅

**Verifica en Supabase:**
1. Ve a Supabase → users table
2. El usuario está ahí pero con `deleted_at = [timestamp]` ✅

---

## 🔄 Recuperar datos eliminados

### **Caso 1: Recuperar un usuario**

En Supabase SQL Editor, ejecuta:
```sql
-- Ver usuarios eliminados
SELECT id, username, email, deleted_at 
FROM users 
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- Restaurar usuario específico (ej: id = 5)
UPDATE users 
SET deleted_at = NULL 
WHERE id = 5;
```

**En el frontend:** Recarga la página → El usuario vuelve a aparecer ✅

### **Caso 2: Recuperar una empresa**

```sql
-- Ver empresas eliminadas
SELECT id, name, deleted_at 
FROM companies 
WHERE deleted_at IS NOT NULL;

-- Restaurar empresa (ej: id = 3)
UPDATE companies 
SET deleted_at = NULL 
WHERE id = 3;
```

### **Caso 3: Recuperar un archivo**

```sql
-- Ver archivos eliminados
SELECT id, name, type, deleted_at 
FROM files 
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- Restaurar archivo (ej: id = 42)
UPDATE files 
SET deleted_at = NULL 
WHERE id = 42;
```

### **Caso 4: Ver archivos eliminados de una empresa específica**

```sql
SELECT id, name, type, deleted_at 
FROM files 
WHERE company_id = 5 
  AND deleted_at IS NOT NULL
ORDER BY deleted_at DESC;
```

---

## 📊 Verificaciones útiles

### ¿Cuántos registros han sido eliminados?
```sql
-- Usuarios eliminados
SELECT COUNT(*) as deleted_users FROM users WHERE deleted_at IS NOT NULL;

-- Empresas eliminadas
SELECT COUNT(*) as deleted_companies FROM companies WHERE deleted_at IS NOT NULL;

-- Archivos eliminados
SELECT COUNT(*) as deleted_files FROM files WHERE deleted_at IS NOT NULL;
```

### ¿Quién eliminó qué y cuándo?
```sql
-- Usuarios eliminados (con detalles)
SELECT id, username, email, deleted_at 
FROM users 
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC
LIMIT 10;
```

### Ver TODOS los datos (incluyendo eliminados)
```sql
-- Todos los usuarios
SELECT id, username, email, role, deleted_at 
FROM users 
ORDER BY created_at DESC;
-- Aquí ves active (deleted_at = NULL) y eliminated (deleted_at = timestamp)
```

---

## 🛡️ Lógica de funcionamiento

```
FLUJO COMPLETO:
═════════════════════════════════════════════════════════════

1. Admin clickea DELETE usuario
   ↓
2. Frontend: DELETE /api/admin/users/5
   ↓
3. Backend: db.deleteUser(5)
   ↓
4. BD: UPDATE users SET deleted_at = NOW() WHERE id = 5
   ↓
5. BD query result: deleted_at = "2026-04-01 10:30:45"
   ↓
6. Frontend refresca: getAllUsers() 
   ↓
7. BD query: SELECT * FROM users WHERE deleted_at IS NULL
   ↓
8. Usuario NO aparece en lista (deletedAt ≠ NULL)
   ↓
9. Admin hace SQL query: UPDATE users SET deleted_at = NULL WHERE id = 5
   ↓
10. Frontend refresca: getAllUsers()
   ↓
11. BD query: SELECT * FROM users WHERE deleted_at IS NULL
   ↓
12. Usuario APARECE en lista (deletedAt = NULL)
```

---

## 🎯 Resumen de comandos SQL frecuentes

```sql
-- ===== RESTAURAR =====
-- Restaurar último usuario eliminado
UPDATE users SET deleted_at = NULL 
WHERE id = (SELECT id FROM users WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 1);

-- Restaurar todos los usuarios eliminados hoy
UPDATE users 
SET deleted_at = NULL 
WHERE deleted_at IS NOT NULL AND DATE(deleted_at) = TODAY;

-- ===== LISTAR ELIMINADOS =====
-- Últimos 10 eliminados
SELECT id, username, deleted_at FROM users 
WHERE deleted_at IS NOT NULL 
ORDER BY deleted_at DESC LIMIT 10;

-- ===== ELIMINAR PERMANENTEMENTE =====
-- Eliminar permanentemente registros eliminados hace > 30 días
DELETE FROM users 
WHERE deleted_at IS NOT NULL 
  AND deleted_at < NOW() - INTERVAL '30 days';
```

---

## ✨ Beneficios

| Aspecto | Antes | Ahora |
|--------|-------|-------|
| **Si borras por error** | Datos perdidos para siempre | ¡Se recuperan con una query! |
| **Recuperación de datos** | Necesitas backup | Datos en la misma BD |
| **Auditoría** | No hay rastro | `deleted_at` muestra cuándo se borró |
| **Performance** | Queries normales | Índices en deleted_at → O(1) |
| **Compatibilidad** | - | Frontend automáticamente ignora deleted |

---

## ⚠️ Notas importantes

1. **Los datos recuperados quedan exactamente igual** → Restauras COMPLETOS
2. **Podrías hacer delete permanente después de 30-60 días** (agregar script automático)
3. **El frontend NUNCA muestra deleted_at = NOT NULL** → Lógica automática
4. **Las contraseñas de usuarios eliminados siguen encriptadas** → Seguro

---

## 🤔 ¿Qué sigue?

**Próximas mejoras (opcionales):**
- Agregar UI para "Papelera" → Ver eliminados + Restaurar desde UI
- Audit logs → Registrar quién eliminó qué y cuándo
- Borrado automático después de 30 días
- Two-step confirmation antes de borrar
