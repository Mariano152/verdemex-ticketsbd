# ⚡ QUICK START: RBAC + MULTI-TENANT

## 🔥 Lo que se hizo:

✅ Sistema completo de login/autenticación  
✅ Roles (admin y user)  
✅ Multi-tenant (empresas)  
✅ Panel de admin para gestionar usuarios y empresas  
✅ Contraseñas encriptadas con bcryptjs  
✅ Tokens JWT de 7 días  
✅ Protección de rutas con middlewares  

---

## ⚡ Implementar en 5 minutos:

### 1️⃣ Base de Datos (Supabase)
Copia todos los queries de `SETUP_RBAC.md` (PASO 1) y pégalos en Supabase SQL Console.

### 2️⃣ Backend
```bash
cd backend
npm install
# Edita .env con tu DATABASE_URL
npm run setup-admin  # Crear primer admin
npm start
```

### 3️⃣ Frontend
```bash
cd frontend/verdemex-frontend
npm install
npm run dev
```

### 4️⃣ Login
- Usuario: `admin` (o el que creaste en setup-admin)
- Contraseña: (la que pusiste)

---

## 👥 Crear nuevos usuarios

**Opción 1: Panel Admin (RECOMENDADO)**
1. Login como admin
2. Click en botón "👑 Admin"
3. Sección "👥 Gestionar Usuarios"
4. Completa formulario y crea

**Opción 2: Script**
```bash
npm run setup-admin
```

---

## 🎯 Permisos

### Admin (👑)
- Crear/eliminar empresas
- Crear/eliminar/editar usuarios
- Ver historial de archivos ("Movimientos Anteriores")
- Eliminar archivos
- Panel de administración

### Usuario Normal (👤)
- Crear Excels, TXTs, ZIPs
- Ver empresas a las que tiene acceso
- NO ve historial
- NO ve panel admin

---

## 📁 Archivos Nuevos

```
backend/
  - src/auth.js ✨
  - src/setupAdmin.js ✨
  - .env ✨

frontend/
  - src/pages/Login.jsx ✨
  - src/pages/CompanySelect.jsx ✨
  - src/pages/AdminPanel.jsx ✨
  - src/styles/Login.css ✨
  - src/styles/CompanySelect.css ✨
  - src/styles/AdminPanel.css ✨
```

---

## 🔑 Variables de entorno (.env)

```env
DATABASE_URL=postgresql://... (de Supabase)
JWT_SECRET=algo_super_secreto_min_32_chars
JWT_EXPIRES_IN=7d
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
PORT=3001
```

---

## 🚀 Rutas principales (API)

```
POST   /api/auth/login                      → Login
GET    /api/auth/profile                    → Mi perfil
POST   /api/admin/users                     → Crear usuario
GET    /api/admin/users                     → Listar usuarios
DELETE /api/admin/users/:userId             → Eliminar usuario
POST   /api/companies                       → Crear empresa
GET    /api/companies                       → Mis empresas
DELETE /api/companies/:id                   → Eliminar empresa
POST   /api/generate-excel (+ companyId)    → Generar excel
```

---

## ⚠️ Importante

1. **Contraseñas**: Se hashean con bcryptjs (salt 10)
2. **Base de datos**: Se crean tablas automáticamente en Supabase
3. **JWT**: Válidos 7 días (configurable)
4. **Permisos**: Verificados en middleware en CADA request

---

## 🔍 Verificar que funciona

```bash
# Terminal 1: Backend
cd backend
npm start
# Deberías ver: "✅ BD conectada" y "🚀 Backend corriendo"

# Terminal 2: Frontend
cd frontend/verdemex-frontend
npm run dev
# Abre http://localhost:5173
# Deberías ver pantalla de login

# Prueba:
# username: admin
# password: (la que creaste)
```

---

## 📚 Documentación completa

Ver `SETUP_RBAC.md` para detalles, problemas comunes, estructura de datos, etc.

---

## 💬 Resumen: Cómo gerenciar usuarios

| Acción | Cómo | Quién |
|--------|------|-------|
| **Crear usuario** | Panel Admin → "Gestionar Usuarios" | Admin |
| **Ver usuarios** | Panel Admin → Panel admin | Admin |
| **Cambiar rol** | Panel Admin → Dropdown rol | Admin |
| **Eliminar usuario** | Panel Admin → Botón 🗑️ | Admin |
| **Crear empresa** | Selector empresas → "+ Nueva" | Admin |
| **Ver empresas** | Selector empresas | Todos |
| **Eliminar empresa** | Selector empresas → 🗑️ | Admin |

---

**¡Listo para usar! 🎉**
