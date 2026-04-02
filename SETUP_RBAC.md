# 🔐 GUÍA DE IMPLEMENTACIÓN: RBAC + MULTI-TENANT

## 📋 RESUMEN DE CAMBIOS

Se ha implementado un sistema completo de autenticación y RBAC (Role-Based Access Control) con soporte multi-tenant (empresas).

### ✅ Archivos Creados:
- `backend/src/auth.js` - Autenticación y JWT
- `backend/src/setupAdmin.js` - Script para crear primer admin
- `backend/.env` - Variables de entorno
- `frontend/src/pages/Login.jsx` - Pantalla de login
- `frontend/src/pages/CompanySelect.jsx` - Selector de empresas
- `frontend/src/pages/AdminPanel.jsx` - Panel de administración
- `frontend/src/styles/Login.css` - Estilos login
- `frontend/src/styles/CompanySelect.css` - Estilos selector
- `frontend/src/styles/AdminPanel.css` - Estilos admin

### 🔄 Archivos Modificados:
- `backend/package.json` - Agregadas dependencias (bcryptjs, jsonwebtoken, dotenv)
- `backend/src/database.js` - Agregadas funciones RBAC y multi-tenant
- `backend/src/server.js` - Agregadas rutas de autenticación y empresas
- `frontend/src/App.jsx` - Agregado flujo de autenticación
- `frontend/src/index.css` - Agregados estilos nuevos

---

## 🚀 PASO 1: CONFIGURAR LA BASE DE DATOS EN SUPABASE

### En la consola SQL de Supabase:

1. Copia todos los queries de abajo y ejecútalos **uno por uno**:

```sql
-- 1. Crear tabla USERS
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'admin' o 'user'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear tabla COMPANIES
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Crear tabla COMPANY_MEMBERS (relación N:M)
CREATE TABLE IF NOT EXISTS company_members (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'admin' o 'user' en esa empresa
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, company_id)
);

-- 4. Actualizar tabla FILES (agregar company_id y created_by)
ALTER TABLE files ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL;

-- 5. Crear tabla COMPANY_CONFIG
CREATE TABLE IF NOT EXISTS company_config (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  config_data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Crear índices
CREATE INDEX IF NOT EXISTS idx_files_company_id ON files(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
```

---

## 🔧 PASO 2: CONFIGURAR BACKEND

### 1. Instalar dependencias:

```bash
cd backend
npm install
```

### 2. Configurar `.env`:

Edita `backend/.env` y actualiza con tus credenciales:

```env
DATABASE_URL=postgresql://postgres.xxxx:[PASSWORD]@db.supabase.co:5432/postgres
JWT_SECRET=tu_clave_super_secreta_minimo_32_caracteres_cambiar_esto
JWT_EXPIRES_IN=7d
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
PORT=3001
```

**Obtén DATABASE_URL desde Supabase:**
- Ve a tu proyecto > Database > Connection Strings > URI (copy)

### 3. Crear el primer usuario admin:

```bash
npm run setup-admin
```

Te pedirá:
- ✏️ Nombre de usuario
- 📧 Email
- 🔐 Contraseña
- ✔️ Confirmar contraseña

**Guarda estos datos, los necesitarás para tu primer login.**

### 4. Iniciar backend:

```bash
npm start
```

Deberías ver:
```
✅ BD conectada correctamente
🚀 Backend corriendo en puerto 3001
```

---

## 🎨 PASO 3: CONFIGURAR FRONTEND

### 1. Instalar dependencias:

```bash
cd frontend/verdemex-frontend
npm install
```

### 2. Configurar API URL (si es necesario):

En `frontend/verdemex-frontend/.env`:

```env
VITE_API_URL=http://localhost:3001
```

### 3. Iniciar frontend:

```bash
npm run dev
```

Abre `http://localhost:5173`

---

## 🔑 FLUJO DE USO

### 📱 Para el Administrador:

1. **Primer Login**
   - Usuario: `admin`
   - Contraseña: (la que creaste en setup)

2. **Pantalla de Selección de Empresa**
   - Ver empresas existentes ✅
   - Crear nueva empresa ➕
   - Eliminar empresa 🗑️

3. **Panel Principal**
   - Usar las funcionalidades normales (Conductores, Generar Excel, etc.)
   - BONUS: Botón "👑 Admin" para acceder al panel de administración

4. **Panel de Administración** (botón 👑 Admin)
   - **Gestionar Usuarios**
     - ➕ Crear nuevo usuario (username, email, contraseña, rol)
     - 👥 Ver todos los usuarios
     - 🔄 Cambiar rol de usuario (admin ↔ user)
     - 🗑️ Eliminar usuario
   - **Gestionar Empresas**
     - ➕ Crear empresa
     - 📋 Ver todas las empresas
     - 🗑️ Eliminar empresa (borra todos sus datos)

### 👤 Para el Usuario Normal:

1. **Login**
   - Usuario y contraseña proporcionados por el admin

2. **Seleccionar Empresa**
   - Solo ve empresas a las que tiene acceso
   - No puede crear ni eliminar empresas

3. **Usar la App**
   - ✅ Crear Excels, TXTs, ZIPs
   - ❌ **NO** ve la pestaña "Movimientos Anteriores" (historial)
   - ❌ **NO** puede ver el Panel de Admin

---

## 🛡️ CÓMO CREAR NUEVOS USUARIOS

### Método 1: Admin Panel (RECOMENDADO)

1. Login como admin
2. Clickea el botón "👑 Admin"
3. En la pestaña "👥 Gestionar Usuarios"
4. Completa el formulario:
   - Usuario: `nombre_usuario`
   - Email: `usuario@empresa.com`
   - Contraseña: (mínimo 6 caracteres)
   - Rol: `usuario normal` o `Administrador`
5. Clickea "+ Crear Usuario"

El usuario recibe un mensaje de éxito. ✅

### Método 2: Script Manual (para desarrollo)

```bash
cd backend/src
# Crear un script temporal similar a setupAdmin.js
node scriptCrearUsuario.js
```

### Método 3: Directamente en Base de Datos (NO RECOMENDADO - emergencia solo)

```sql
-- NO hacer esto normalmente, las contraseñas deben estar hasheadas
-- Usar solo si algo falló y necesitas acceso emergencia
SELECT * FROM users;
```

---

## 🔐 SEGURIDAD - CONTRASEÑAS

### ✅ Qué hace bien:

- **Hash de contraseña**: Se usan `bcryptjs` (salt rounds: 10)
- **Nunca en texto plano**: La BD solo tiene hashes
- **JWT**: Tokens de 7 días

### 🔧 Cambiar contraseña propia:

Falta implementar, pero es simple:
```javascript
// POST /api/auth/change-password
{
  "oldPassword": "actual",
  "newPassword": "nueva"
}
```

---

## 🚨 PROBLEMAS COMUNES

### ❌ "CORS blocked"
- Verifica `CORS_ORIGIN` en `.env` del backend
- Debe incluir `http://localhost:5173`

### ❌ "BD conectada correctamente pero no see datos"
- Ejecutaste los queries SQL? ✓
- El `DATABASE_URL` es correcto? ✓

### ❌ "Usuario no encontrado" al hacer login
- ¿Ejecutaste `npm run setup-admin`? ✓
- ¿La contraseña es correcta? ✓

### ❌ Token inválido o expirado
- JWT dura 7 días (configurable en `.env`)
- Logout y vuelve a hacer login

---

## 📊 ESTRUCTURA DE DATOS

### Users (Usuarios)
```
id, username, email, password_hash, role, created_at, updated_at
```

### Companies (Empresas)
```
id, name, created_by (user_id), created_at, updated_at
```

### Company_Members (Relación Usuario-Empresa)
```
id, user_id, company_id, role (admin/user en esa empresa), created_at
```

### Files (Archivos - actualizado)
```
id, company_id, name, type, path, created_by (user_id), created_at
```

### Company_Config (Configuración por empresa)
```
id, company_id (unique), config_data (JSONB), updated_at
```

---

## 🔄 RUTAS API

### Autenticación
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Obtener perfil
- `POST /api/auth/change-password` - Cambiar contraseña

### Usuarios (solo admin)
- `POST /api/admin/users` - Crear usuario
- `GET /api/admin/users` - Listar todos
- `PUT /api/admin/users/:userId/role` - Cambiar rol
- `DELETE /api/admin/users/:userId` - Eliminar

### Empresas
- `GET /api/companies` - Mis empresas
- `POST /api/companies` - Crear (admin)
- `DELETE /api/companies/:id` - Eliminar (admin)
- `GET /api/companies/:id/members` - Miembros (admin)
- `POST /api/companies/:id/members` - Agregar usuario (admin)
- `DELETE /api/companies/:id/members/:userId` - Remover (admin)

### Archivos
- `POST /api/generate-excel` - Generar (requiere companyId)
- `POST /api/excel-to-txt` - Convertir a TXT (requiere companyId)
- `POST /api/excel-to-txt-zip` - Crear ZIP (requiere companyId)
- `GET /api/companies/:id/files` - Ver archivos (admin only)
- `GET /api/files/download/:id` - Descargar archivo
- `DELETE /api/files/:id` - Eliminar (admin only)

---

## 💾 PRÓXIMAS MEJORAS

1. **Cambio de contraseña de usuario** ✋
2. **Reset de contraseña olvidada** 
3. **Roles por empresa** (admin de una empresa, no global)
4. **Auditoría de acciones** (quién hizo qué y cuándo)
5. **Gestión de miembros de empresa** (ver y remover usuarios)
6. **Autenticación 2FA**
7. **Tokens refresh automáticos**

---

## 📞 RESUMEN RÁPIDO

```bash
# Setup inicial
1. Ejecutar queries SQL en Supabase ✓
2. npm install en backend y frontend ✓
3. Configurar .env en backend ✓
4. npm run setup-admin en backend ✓
5. npm start (backend) ✓
6. npm run dev (frontend) ✓

# Crear nuevos usuarios:
→ Panel Admin (botón 👑 Admin en la app)
