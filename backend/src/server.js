const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const archiver = require("archiver");
require('dotenv').config();

const { generateExcel } = require("./excelGenerator");
const { loadConfig, saveConfig } = require("./configStore");
const { excelToTxtBuffer, excelToTicketFiles } = require("./excelToTxt");
const { formatDateForFilename } = require("./utils");

// Autenticación y BD
const db = require("./database");
const { registerUser, loginUser, changePassword, authMiddleware, adminMiddleware } = require("./auth");
const photosRoutes = require("./photosRoutes");

const app = express();

// -------------------------
// CORS
// -------------------------
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked: " + origin));
    },
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options(/.*/, cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// output folder
const outDir = path.join(__dirname, "..", "output");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// -------------------------
// Helpers
// -------------------------
function safeLoadConfig() {
  try {
    return loadConfig();
  } catch (e) {
    return {
      company: {
        reportTitle: "CONTROL DE RESIDUOS",
        basculaCertificada: "",
        precioPorTon: 0,
      },
      rules: {
        skipSundays: false,
        decimalsPesoTon: 2,
        kgRounding: 2,
      },
      drivers: [],
    };
  }
}

function getOutputFilename(excelFilename, extension, uniqueId) {
  let baseName = excelFilename.replace(/\.xlsx$/i, '');
  baseName = baseName.replace(/\s*\(\d+\)$/, '');
  const ticketName = baseName.replace(/^reporte_/, 'tickets_');
  return `${ticketName}_${uniqueId}.${extension}`;
}

// ============================================
// 🔐 RUTAS DE AUTENTICACIÓN (SIN PROTEGER)
// ============================================

// 1. LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Usuario y contraseña requeridos" });
    }
    
    const { token, user } = await loginUser(username, password, db);
    return res.json({ ok: true, token, user });
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }
});

// 2. GET PROFILE
app.get("/api/auth/profile", authMiddleware, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    return res.json({ ok: true, user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 3. CAMBIAR CONTRASEÑA
app.post("/api/auth/change-password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "Ambas contraseñas requeridas" });
    }
    
    const user = await changePassword(req.user.userId, oldPassword, newPassword, db);
    return res.json({ ok: true, message: "Contraseña actualizada", user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// DEBUG: Verificar usuarios en BD
app.get("/api/debug/users", async (req, res) => {
  try {
    console.log("📋 DEBUG: Listando todos los usuarios...");
    const users = await db.getAllUsers();
    return res.json({ ok: true, count: users.length, users: users.map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role })) });
  } catch (err) {
    return res.status(500).json({ error: "Error listando usuarios: " + err.message });
  }
});

// ============================================
// 👥 RUTAS DE USUARIOS (ADMIN ONLY)
// ============================================

// 4. CREAR NUEVO USUARIO (solo ADMIN/SUPERADMIN - excluye crear superadmin)
app.post("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }
    // Solo se pueden crear usuarios 'user' o 'admin', no 'superadmin'
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: "Role inválido - solo 'admin' o 'user'" });
    }
    
    const user = await registerUser(username, email, password, role, db);
    return res.json({ ok: true, user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 5. OBTENER TODOS LOS USUARIOS (solo ADMIN)
app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    return res.json({ ok: true, users });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 6. ACTUALIZAR ROLE DE USUARIO (solo ADMIN/SUPERADMIN)
app.put("/api/admin/users/:userId/role", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    // Solo admin y user pueden ser asignados. Para superadmin solo lo hace el sistema
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: "Role inválido - solo 'admin' o 'user'" });
    }
    
    // Obtener el usuario a actualizar
    const userToUpdate = await db.getUserById(userId);
    if (userToUpdate && userToUpdate.role === 'superadmin') {
      return res.status(403).json({ error: "No se puede cambiar el role del superadministrador" });
    }
    
    if (parseInt(userId) === req.user.userId && role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(400).json({ error: "No puedes quitarte el rol de admin" });
    }
    
    const user = await db.updateUserRole(userId, role);
    return res.json({ ok: true, user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 7. ELIMINAR USUARIO (solo ADMIN/SUPERADMIN)
app.delete("/api/admin/users/:userId", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (parseInt(userId) === req.user.userId) {
      return res.status(400).json({ error: "No puedes eliminar tu propia cuenta" });
    }
    
    // Obtener el usuario a eliminar para verificar su rol
    const userToDelete = await db.getUserById(userId);
    if (userToDelete && userToDelete.role === 'superadmin') {
      return res.status(403).json({ error: "No se puede eliminar al superadministrador" });
    }
    
    const user = await db.deleteUser(userId);
    return res.json({ ok: true, user });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ============================================
// 🏢 RUTAS DE EMPRESAS
// ============================================

// 8. GET EMPRESAS DEL USUARIO ACTUAL
app.get("/api/companies", authMiddleware, async (req, res) => {
  try {
    // Todos los usuarios (admin y normales) ven TODAS las empresas
    // Solo restringimos operaciones (crear, eliminar, asignar miembros) a admins
    const companies = await db.getAllCompanies();
    return res.json({ ok: true, companies });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 9. CREAR EMPRESA (solo ADMIN)
app.post("/api/companies", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Nombre de empresa requerido" });
    }
    
    const company = await db.createCompany(name, req.user.userId);
    return res.json({ ok: true, company });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 10. ELIMINAR EMPRESA (solo ADMIN)
app.delete("/api/companies/:companyId", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await db.deleteCompany(companyId);
    return res.json({ ok: true, company });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 11. OBTENER MIEMBROS DE UNA EMPRESA (solo ADMIN)
app.get("/api/companies/:companyId/members", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;
    const members = await db.getCompanyMembers(companyId);
    return res.json({ ok: true, members });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 12. AGREGAR USUARIO A EMPRESA (solo ADMIN)
app.post("/api/companies/:companyId/members", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { userId, role } = req.body;
    
    const member = await db.addUserToCompany(userId, companyId, role || 'user');
    return res.json({ ok: true, member });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 13. REMOVER USUARIO DE EMPRESA (solo ADMIN)
app.delete("/api/companies/:companyId/members/:userId", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { companyId, userId } = req.params;
    const member = await db.removeUserFromCompany(userId, companyId);
    return res.json({ ok: true, member });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ============================================
// 📁 RUTAS DE ARCHIVOS
// ============================================

// 14. CONFIG (GET/POST)
app.get("/api/config", (req, res) => {
  res.json(safeLoadConfig());
});

app.post("/api/config", (req, res) => {
  saveConfig(req.body);
  res.json({ ok: true });
});
// 15. GENERAR EXCEL (protegido)
app.post("/api/generate-excel", authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, lastTicketNumber, lastTicketDate, spacingVariance, 
            spacingVarianceRange, dailyTicketCount, dailyTicketCountRange, config, 
            holidayDates, companyId } = req.body;

    if (!companyId) return res.status(400).json({ error: "companyId requerido" });
    if (!startDate || !endDate) return res.status(400).json({ error: "Faltan fechas" });
    if (lastTicketNumber === undefined || lastTicketNumber === null || lastTicketNumber === "") {
      return res.status(400).json({ error: "Falta lastTicketNumber" });
    }
    if (!config) return res.status(400).json({ error: "Config requerida" });
    
    const startDateFormatted = formatDateForFilename(new Date(startDate));
    const endDateFormatted = formatDateForFilename(new Date(endDate));
    const uniqueId = Date.now();
    const fileName = `reporte_${startDateFormatted}-${endDateFormatted}_${uniqueId}.xlsx`;
    
    const result = await generateExcel({
      config,
      startDateISO: startDate,
      endDateISO: endDate,
      lastTicketNumber: Number(lastTicketNumber),
      lastTicketDate,
      spacingVariance: Number(spacingVariance),
      spacingVarianceRange: Number(spacingVarianceRange),
      dailyTicketCount: Number(dailyTicketCount),
      dailyTicketCountRange: Number(dailyTicketCountRange),
      outputName: fileName,
      holidayDates: holidayDates || []
    });

    const { filePath, updatedConfig } = result;
    
    // Leer el archivo generado como buffer
    const fileBuffer = fs.readFileSync(filePath);
    
    // Guardar en BD como BLOB
    await db.saveFileWithCompanyAndData(companyId, req.user.userId, fileName, 'excel', fileBuffer);
    
    // Guardar config en BD
    await db.saveCompanyConfig(companyId, updatedConfig);
    
    res.setHeader("X-Updated-Config", JSON.stringify(updatedConfig));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(fileBuffer);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

// 16. EXCEL TO TXT
app.post("/api/excel-to-txt", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se subió archivo" });
    
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ error: "companyId requerido" });

    const buf = await excelToTxtBuffer(req.file.buffer);
    const uniqueId = Date.now();
    const outName = getOutputFilename(req.file.originalname, 'txt', uniqueId);

    // Guardar directamente como BLOB (sin pasar por filesystem)
    await db.saveFileWithCompanyAndData(companyId, req.user.userId, outName, 'txt', buf);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
    return res.send(buf);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

// 17. EXCEL TO ZIP
app.post("/api/excel-to-txt-zip", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se subió archivo" });
    
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ error: "companyId requerido" });

    const files = await excelToTicketFiles(req.file.buffer);
    const uniqueId = Date.now();
    const zipName = getOutputFilename(req.file.originalname, 'zip', uniqueId);

    // Crear ZIP en memoria (sin guardar en disco)
    const buffers = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => { throw err; });
    archive.on("data", (data) => { buffers.push(data); });

    for (const f of files) {
      archive.append(f.content, { name: f.name });
    }

    await archive.finalize();

    // Combinar todos los buffers del ZIP
    const zipBuffer = Buffer.concat(buffers);

    // Guardar en BD como BLOB
    await db.saveFileWithCompanyAndData(companyId, req.user.userId, zipName, 'zip', zipBuffer);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    return res.send(zipBuffer);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

// 18. OBTENER ARCHIVOS DE UNA EMPRESA
app.get("/api/companies/:companyId/files", authMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Si es admin global, permitir acceso a todas las empresas
    if (req.user.role === 'admin') {
      const files = await db.getFilesByCompany(companyId);
      return res.json({ ok: true, files });
    }
    
    // Si es usuario normal, verificar que tenga acceso a la empresa
    const companies = await db.getCompaniesByUserId(req.user.userId);
    const hasAccess = companies.some(c => c.id === parseInt(companyId));
    
    if (!hasAccess) {
      return res.status(403).json({ error: "No tienes acceso a esta empresa" });
    }
    
    const files = await db.getFilesByCompany(companyId);
    return res.json({ ok: true, files });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 19. OBTENER ARCHIVOS POR TIPO Y EMPRESA
app.get("/api/companies/:companyId/files/type/:type", authMiddleware, async (req, res) => {
  try {
    const { companyId, type } = req.params;
    
    // Si es admin global, permitir acceso a todas las empresas
    if (req.user.role === 'admin') {
      const files = await db.getFilesByCompanyAndType(companyId, type);
      return res.json({ ok: true, files });
    }
    
    // Si es usuario normal, verificar que tenga acceso a la empresa
    const companies = await db.getCompaniesByUserId(req.user.userId);
    const hasAccess = companies.some(c => c.id === parseInt(companyId));
    
    if (!hasAccess) {
      return res.status(403).json({ error: "No tienes acceso a esta empresa" });
    }
    
    const files = await db.getFilesByCompanyAndType(companyId, type);
    return res.json({ ok: true, files });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// 20. DESCARGAR ARCHIVO POR ID
app.get("/api/files/download/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Intentar obtener con file_data (BLOB)
    const file = await db.getFileByIdWithData(id);
    
    if (!file) {
      return res.status(404).json({ error: "Archivo no encontrado en BD" });
    }

    // Si tiene file_data (guardado como BLOB), enviar desde memoria
    if (file.file_data) {
      console.log(`📥 Descargando desde BD (BLOB): ${file.name}`);
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      
      // Configurar tipo MIME según el tipo de archivo
      if (file.type === 'excel') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else if (file.type === 'txt') {
        res.setHeader('Content-Type', 'text/plain');
      } else if (file.type === 'zip') {
        res.setHeader('Content-Type', 'application/zip');
      }
      
      return res.send(file.file_data);
    }

    // Si no tiene file_data, intentar desde filesystem (legado)
    let filePath = file.path;

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Archivo no encontrado en ruta esperada: ${filePath}`);
      console.warn(`📁 Buscando en: ${outDir}`);
      
      try {
        const outputFiles = fs.readdirSync(outDir);
        const fileName = file.name;
        const ext = path.extname(fileName);
        const baseNameWithoutExt = path.basename(fileName, ext);
        
        console.log(`🔍 Buscando archivo base: "${baseNameWithoutExt}", extensión: "${ext}"`);
        console.log(`📂 Archivos disponibles en output: ${outputFiles.join(', ')}`);
        
        let foundFile = outputFiles.find(f => f === fileName);
        if (!foundFile) {
          foundFile = outputFiles.find(f => {
            return f.endsWith(ext) && f.startsWith(baseNameWithoutExt);
          });
        }
        if (!foundFile) {
          foundFile = outputFiles.find(f => f.endsWith(ext));
        }
        
        if (foundFile) {
          const newPath = path.join(outDir, foundFile);
          filePath = newPath;
          console.log(`✅ Ruta corregida: ${newPath}`);
        } else {
          console.error(`❌ No se encontró archivo en ${outDir}`);
          return res.status(404).json({ error: "Archivo no encontrado" });
        }
      } catch (err) {
        console.error(`❌ Error buscando archivo: ${err.message}`);
        return res.status(500).json({ error: "Error buscando archivo" });
      }
    }

    console.log(`📥 Descargando desde disco: ${filePath}`);
    res.download(filePath, file.name);
  } catch (err) {
    console.error(`❌ Error en descarga: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// 20B. SINCRONIZAR ARCHIVOS (ADMIN) - Corrige rutas incorrectas en BD
app.post("/api/admin/sync-files", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log("🔄 Iniciando sincronización de archivos...");
    
    const allFiles = await db.pool.query('SELECT id, name, path, company_id FROM files WHERE deleted_at IS NULL');
    const dbFiles = allFiles.rows;
    
    const outputFiles = fs.readdirSync(outDir).filter(f => !fs.statSync(path.join(outDir, f)).isDirectory());
    
    let corrected = 0;
    let notFound = 0;
    const results = [];
    
    for (const dbFile of dbFiles) {
      const fileExists = fs.existsSync(dbFile.path);
      
      if (fileExists) {
        results.push({ id: dbFile.id, name: dbFile.name, status: "✅ OK" });
        continue;
      }
      
      // Buscar el archivo por nombre
      const fileName = dbFile.name;
      const ext = path.extname(fileName);
      const baseNameWithoutExt = path.basename(fileName, ext);
      
      let foundFile = null;
      
      // Primero intenta coincidencia exacta
      foundFile = outputFiles.find(f => f === fileName);
      
      // Luego por patrón del nombre
      if (!foundFile) {
        foundFile = outputFiles.find(f => 
          f.endsWith(ext) && f.startsWith(baseNameWithoutExt)
        );
      }
      
      // Última opción: archivo con la misma extensión
      if (!foundFile && ext) {
        foundFile = outputFiles.find(f => f.endsWith(ext));
      }
      
      if (foundFile) {
        const newPath = path.join(outDir, foundFile);
        await db.pool.query(
          'UPDATE files SET path = $1 WHERE id = $2',
          [newPath, dbFile.id]
        );
        corrected++;
        results.push({ 
          id: dbFile.id, 
          name: dbFile.name, 
          status: `🔧 Corregida → ${foundFile}` 
        });
        console.log(`🔧 Corregida ruta para ID ${dbFile.id}: ${fileName} → ${newPath}`);
      } else {
        notFound++;
        results.push({ 
          id: dbFile.id, 
          name: dbFile.name, 
          status: "❌ No encontrado" 
        });
        console.log(`❌ No encontrado archivo para ID ${dbFile.id}: ${fileName}`);
      }
    }
    
    console.log(`✅ Sincronización completada: ${dbFiles.length} archivos revisados, ${corrected} corregidos, ${notFound} no encontrados`);
    return res.json({ 
      ok: true, 
      message: `Sincronización completada: ${corrected} corregidos, ${notFound} no encontrados`,
      results 
    });
  } catch (err) {
    console.error(`❌ Error en sincronización: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// 21. ELIMINAR ARCHIVO (solo ADMIN)
app.delete("/api/files/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const file = await db.getFileById(id);
    
    if (!file) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    await db.deleteFileById(id);

    return res.json({ ok: true, message: "Archivo eliminado" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// ============================================
// 📸 RUTAS DE FOTOS PARA REPORTES
// ============================================
app.use("/api/companies/:companyId/photos", photosRoutes);

// -------------------------
// LISTEN
// -------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
  console.log(`📝 Para crear el primer admin, ejecuta: npm run setup-admin`);
});
