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
    
    // Guardar en BD
    await db.saveFileWithCompany(companyId, req.user.userId, fileName, 'excel', filePath);
    
    // Guardar config en BD
    await db.saveCompanyConfig(companyId, updatedConfig);
    
    res.setHeader("X-Updated-Config", JSON.stringify(updatedConfig));
    return res.download(filePath, fileName);
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
    const outPath = path.join(outDir, outName);
    fs.writeFileSync(outPath, buf);

    // Guardar en BD
    await db.saveFileWithCompany(companyId, req.user.userId, outName, 'txt', outPath);

    return res.download(outPath, outName);
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
    const zipPath = path.join(outDir, zipName);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => { throw err; });
    archive.pipe(output);

    for (const f of files) {
      archive.append(f.content, { name: f.name });
    }

    await archive.finalize();

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    // Guardar en BD
    await db.saveFileWithCompany(companyId, req.user.userId, zipName, 'zip', zipPath);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    const zipStream = fs.createReadStream(zipPath);
    zipStream.pipe(res);
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
    const file = await db.getFileById(id);
    
    if (!file) {
      return res.status(404).json({ error: "Archivo no encontrado en BD" });
    }

    let filePath = file.path;

    // Si el archivo no existe en la ruta esperada, intentar encontrarlo
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
        
        // Estrategia de búsqueda (por prioridad):
        // 1) Coincidencia exacta del nombre completo
        // 2) Archivo que comience por la fecha y contenga la extensión
        // 3) Archivo con el patrón baseNombre_*
        let foundFile = null;
        
        // Estrategia 1: Coincidencia exacta
        foundFile = outputFiles.find(f => f === fileName);
        if (foundFile) {
          console.log(`✅ Encontrado por coincidencia exacta: ${foundFile}`);
        }
        
        // Estrategia 2: Mismo tipo de archivo (extensión)
        if (!foundFile) {
          foundFile = outputFiles.find(f => {
            return f.endsWith(ext) && f.startsWith(baseNameWithoutExt);
          });
          if (foundFile) {
            console.log(`✅ Encontrado por patrón de nombre: ${foundFile}`);
          }
        }
        
        // Estrategia 3: Cualquier archivo con la misma extensión y similar al nombre
        if (!foundFile) {
          foundFile = outputFiles.find(f => f.endsWith(ext));
          if (foundFile) {
            console.log(`⚠️ Encontrado por extensión (pero puede no ser el correcto): ${foundFile}`);
          }
        }
        
        if (foundFile) {
          const newPath = path.join(outDir, foundFile);
          filePath = newPath;
          console.log(`✅ Ruta corregida: ${newPath}`);
          
          // Actualizar BD con la ruta correcta
          try {
            await db.pool.query(
              'UPDATE files SET path = $1 WHERE id = $2',
              [newPath, id]
            );
            console.log(`✅ BD actualizada con ruta correcta para archivo ID: ${id}`);
          } catch (dbErr) {
            console.error(`⚠️ Error actualizando BD, pero continuando con descarga: ${dbErr.message}`);
          }
        } else {
          console.error(`❌ No se encontró archivo en ${outDir}`);
          return res.status(404).json({ error: "Archivo no encontrado en el servidor" });
        }
      } catch (err) {
        console.error(`❌ Error buscando archivo: ${err.message}`);
        return res.status(500).json({ error: "Error buscando archivo" });
      }
    }

    // Verificar existencia final
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Archivo final no encontrado: ${filePath}`);
      return res.status(404).json({ error: "Archivo no existe en el servidor" });
    }

    console.log(`📥 Descargando archivo: ${filePath}`);
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
