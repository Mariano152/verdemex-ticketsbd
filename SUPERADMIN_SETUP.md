# 👑 Guía de Configuración del Superadmin

## ¿Qué es un Superadmin?

Un **Superadmin** es un usuario especial con los siguientes características:

✅ **Permisos**: Exactamente los mismos que un admin (crear/eliminar usuarios, gestionar empresas, ver reportes)
🔒 **Protecciones**:
  - No puede ser eliminado
  - No se puede cambiar su rol
  - No se puede crear otro superadmin a través de la interfaz
  - Solo existe UNO en todo el sistema

👨‍💼 **Uso**: Destinado al desarrollador/propietario que siempre necesita acceso garantizado

---

## Pasos de Configuración

### 1️⃣ Asegúrate de tener un usuario admin

Si aún no tienes un usuario admin, crea uno desde la interfaz:
```
1. Abre la aplicación
2. Ve a "Administración de Usuarios"
3. Crea un usuario con rol "Administrador"
```

### 2️⃣ Promociona el usuario admin a Superadmin

En la terminal, desde la carpeta `backend`:

```bash
cd backend
node src/promoteSuperadmin.js <nombre_usuario>
```

**Ejemplo**:
```bash
node src/promoteSuperadmin.js admin
```

### 3️⃣ Verifica en la interfaz

- Inicia sesión con el superadmin
- Ve a "Administración de Usuarios"
- Verás que el usuario ahora muestra "👑 Superadmin"
- El botón de eliminar desaparece
- El selector de rol se convierte en texto no editable

---

## Verificación

Después de ejecutar el script, deberías ver:

```
✅ Usuario promovido exitosamente!
📋 Detalles:
   ID: 1
   Usuario: admin
   Email: admin@example.com
   Rol: superadmin

👑 admin es ahora SUPERADMINISTRADOR
```

---

## Notas de Seguridad

⚠️ **IMPORTANTE**:
- Solo puede haber UN superadmin
- No se puede crear otro usando la interfaz
- Si necesitas cambiar el superadmin, primero debes bajar el nivel del actual a "admin"
- El script solo se ejecuta manualmente desde la terminal

---

## Troubleshooting

### "Usuario no encontrado"
```bash
✗ Verifica que escribiste correctamente el nombre de usuario
✗ El usuario debe existir en la base de datos
```

### "El usuario ya es superadmin"
```bash
✓ Esto es normal - el usuario ya está promocionado
```

### Quiero cambiar de superadmin

Si necesitas cambiar quién es el superadmin:

1. Baja el nivel del superadmin actual a "admin":
   - Inicia sesión como otro admin
   - Ve a Administración de Usuarios
   - Cambia el rol a "Administrador"

2. Promueve el nuevo usuario:
   ```bash
   node src/promoteSuperadmin.js nuevo_usuario
   ```

---

## Estructura de Roles

```
┌─────────────────────┐
│     Superadmin      │  ← Solo 1, protegido
│  (Desarrollador)    │
└─────────────────────┘
           ↓
   ┌─────────────────────┐
   │      Admin          │  ← Puede ser múltiple
   │ (Administrador)     │
   └─────────────────────┘
           ↓
   ┌─────────────────────┐
   │      User           │  ← Usuarios normales
   │ (Solo reportes)     │
   └─────────────────────┘
```

---

## Cambios en la Base de Datos

El script actualiza correctamente la columna `role` en la tabla `users`:

```sql
UPDATE users 
SET role = 'superadmin' 
WHERE username = 'admin';
```

---

¡Listo! Tu superadmin está protegido y funcional. 👑
