# 🧪 SOFT DELETES - GUÍA DE PRUEBA Y VERIFICACIÓN

Fecha: 2026-04-01

## ✅ Verificación Rápida (5 minutos)

### Paso 1: Abre el Admin Panel
1. Login en la app
2. Selecciona una empresa
3. Ve a "Panel Admin" → tab "Usuarios"

### Paso 2: Toma nota de un usuario
```
Ejemplo: ID = 5, Username = "testuser", Email = "test@mail.com"
```

### Paso 3: Elimina el usuario
- Click en el botón DELETE de ese usuario
- Espera la respuesta del servidor
- El usuario **DESAPARECE** del Frontend ✅

### Paso 4: Verifica en Supabase que NO se eliminó
1. Ve a Supabase → SQL Editor
2. Ejecuta:
```sql
SELECT id, username, email, deleted_at 
FROM users 
WHERE id = 5;
```

**Resultado esperado:**
```
| id | username | email         | deleted_at          |
|----|----------|---------------|---------------------|
| 5  | testuser | test@mail.com | 2026-04-01 10:30:45 |
```

✅ **El usuario EXISTE en BD con deleted_at != NULL**

### Paso 5: Recupera el usuario
En Supabase SQL Editor, ejecuta:
```sql
UPDATE users 
SET deleted_at = NULL 
WHERE id = 5;
```

### Paso 6: Recarga el Frontend
- Recarga la página del Admin Panel
- El usuario **VUELVE A APARECER** ✅

---

## 📋 Pruebas Completas

### Test 1: Soft Delete de Usuarios

**Procedimiento:**
1. Lista actual: admin, userA, userB, userC
2. DELETE userB
3. Frontend: admin, userA, userC (userB desaparece)
4. BD: userB sigue ahí con deleted_at != NULL

**Verificación SQL:**
```sql
-- Ver usuarios activos (lo que ve el frontend)
SELECT id, username FROM users WHERE deleted_at IS NULL;
-- Resultado: admin, userA, userC

-- Ver usuarios eliminados
SELECT id, username, deleted_at FROM users WHERE deleted_at IS NOT NULL;
-- Resultado: userB con fecha
```

✅ **PASS** si userB aparece solo en la segunda query

---

### Test 2: Soft Delete de Empresas

**Procedimiento:**
1. Admin Panel → Empresas
2. Lista: Empresa A, Empresa B, Empresa C
3. DELETE Empresa B
4. Lista actualizada: Empresa A, Empresa C
5. Empresa B sigue en BD con deleted_at != NULL

**Verificación SQL:**
```sql
SELECT id, name, deleted_at 
FROM companies 
WHERE deleted_at IS NULL;
-- Solo A, C

SELECT id, name, deleted_at 
FROM companies 
WHERE deleted_at IS NOT NULL;
-- Empresa B aparece con fecha
```

✅ **PASS** si Empresa B se recupera correctamente

---

### Test 3: Soft Delete de Archivos

**Procedimiento:**
1. Genera un Excel/TXT
2. Ve a "Archivos" o donde se listen
3. DELETE archivo
4. Archivo desaparece del frontend
5. Sigue existiendo en BD con deleted_at != NULL

**Verificación SQL:**
```sql
SELECT id, name, deleted_at 
FROM files 
WHERE id = [FILE_ID];
-- Verás deleted_at != NULL
```

✅ **PASS** si el archivo se recupera

---

### Test 4: Soft Delete de Company Members

**Procedimiento:**
1. Admin Panel → Empresa X → Miembros
2. Lista: usuario1, usuario2, usuario3
3. REMOVE usuario2 de la empresa
4. Lista: usuario1, usuario3
5. usuario2 sigue en company_members con deleted_at != NULL

**Verificación SQL:**
```sql
SELECT u.username, cm.deleted_at
FROM company_members cm
JOIN users u ON cm.user_id = u.id
WHERE cm.company_id = [COMPANY_ID];
-- usuario2 aparece con deleted_at != NULL
```

✅ **PASS** si se recupera correctamente

---

## 🔍 Verificación de Base de Datos

### ¿Se están guardando los deleted_at?

```sql
-- Contar registros eliminados
SELECT 'users' as tabla, COUNT(*) as eliminados 
FROM users 
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'companies', COUNT(*) 
FROM companies 
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'files', COUNT(*) 
FROM files 
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'company_members', COUNT(*) 
FROM company_members 
WHERE deleted_at IS NOT NULL;
```

**Resultado esperado:** Números > 0 después de hacer deletes

---

## ⚠️ Troubleshooting

### Problema: Al borrar, desaparece del frontend pero SE BORRA DE LA BD

**Solución:**
1. Verifica que el backend esté reiniciado: 
   ```bash
   cd backend
   npm start
   ```
2. Revisa que database.js tenga UPDATE (no DELETE):
   ```bash
   grep -n "UPDATE users SET deleted_at" backend/src/database.js
   ```
   Debería haber resultados.

3. Revisa que getAllUsers() tenga WHERE deleted_at IS NULL:
   ```bash
   grep -n "WHERE deleted_at IS NULL" backend/src/database.js
   ```
   Debería tener muchos resultados.

### Problema: El usuario sigue apareciendo después de DELETE

**Causa:** El filtro deleted_at IS NULL no está funcionando.

**Solución:**
1. Verifica migración fue ejecutada:
   ```sql
   \d users;
   -- Debería mostrar columna deleted_at TIMESTAMP
   ```

2. Si no existe, ejecuta migración:
   ```bash
   cd backend
   node src/runMigration.js ../migrations/003_add_soft_deletes.sql
   ```

3. Reinicia backend:
   ```bash
   npm start
   ```

### Problema: No veo deleted_at en Supabase

**Causa:** Migración no ejecutada.

**Solución:**
1. Ve a Supabase → SQL Editor
2. Copia/pega contenido de `backend/migrations/003_add_soft_deletes.sql`
3. Ejecuta
4. Reinicia backend

---

## 📊 Dashboard de Estado

Para monitorear el sistema de soft deletes:

```sql
-- Estado general
SELECT 
  (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) as users_activos,
  (SELECT COUNT(*) FROM users WHERE deleted_at IS NOT NULL) as users_eliminados,
  (SELECT COUNT(*) FROM companies WHERE deleted_at IS NULL) as companies_activas,
  (SELECT COUNT(*) FROM companies WHERE deleted_at IS NOT NULL) as companies_eliminadas,
  (SELECT COUNT(*) FROM files WHERE deleted_at IS NULL) as files_activos,
  (SELECT COUNT(*) FROM files WHERE deleted_at IS NOT NULL) as files_eliminados;
```

---

## ✨ Resumen

| Componente | Estado | Detalles |
|-----------|--------|---------|
| **Migración** | ✅ | Columnas agregadas |
| **Backend DB** | ✅ | Functions usan UPDATE |
| **Backend API** | ✅ | SELECT usan WHERE deleted_at IS NULL |
| **Frontend** | ✅ | Automáticamente recibe solo activos |
| **Recuperación** | ✅ | UPDATE ... SET deleted_at = NULL |

**Sistema LISTO PARA USAR** 🚀
