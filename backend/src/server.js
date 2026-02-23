const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const archiver = require("archiver");

const { generateExcel } = require("./excelGenerator");
const { loadConfig, saveConfig } = require("./configStore");
const { excelToTxtBuffer, excelToTicketFiles } = require("./excelToTxt");
const { formatDateForFilename } = require("./utils");
const { saveFile, getFiles, getFilesByType, getFileById, deleteFile } = require("./database");

const app = express();

// -------------------------
// CORS (Vercel -> Render)
// -------------------------
// Render env var example:
// CORS_ORIGIN="https://verdemex-ticketsbd.vercel.app,https://verdemex-ticketsbd-xxxxx.vercel.app"
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman ok
      if (allowedOrigins.length === 0) return cb(null, true); // si no configuras, no bloquea
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked: " + origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ IMPORTANTE: evita app.options("*"...)
// En algunos routers/path-to-regexp rompe con "*"
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

// -------------------------
// CONFIG (opcional)
// -------------------------
app.get("/api/config", (req, res) => {
  res.json(safeLoadConfig());
});

app.post("/api/config", (req, res) => {
  saveConfig(req.body);
  res.json({ ok: true });
});

// -------------------------
// GENERAR EXCEL (ÚNICA RUTA)
// -------------------------
app.post("/api/generate-excel", async (req, res) => {
  try {
    const { startDate, endDate, lastTicketNumber, lastTicketDate, spacingVariance, spacingVarianceRange, dailyTicketCount, dailyTicketCountRange, config } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Falta startDate o endDate" });
    }
    if (lastTicketNumber === undefined || lastTicketNumber === null || lastTicketNumber === "") {
      return res.status(400).json({ error: "Falta lastTicketNumber" });
    }
    if (!lastTicketDate) {
      return res.status(400).json({ error: "Falta lastTicketDate" });
    }
    if (!spacingVariance) {
      return res.status(400).json({ error: "Falta spacingVariance" });
    }
    if (!dailyTicketCount) {
      return res.status(400).json({ error: "Falta dailyTicketCount" });
    }
    if (!config || typeof config !== "object") {
      return res.status(400).json({ error: "Falta config en el body" });
    }

    const startDateFormatted = formatDateForFilename(new Date(startDate));
    const endDateFormatted = formatDateForFilename(new Date(endDate));
    const fileName = `reporte_${startDateFormatted}-${endDateFormatted}.xlsx`;
    const filePath = await generateExcel({
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
    });

    // Guardar en base de datos
    await saveFile(fileName, 'excel', filePath);

    return res.download(filePath, fileName);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || "Error generando excel" });
  }
});

// -------------------------
// EXCEL -> TXT ÚNICO
// -------------------------
// Helper para convertir nombre de Excel a TXT/ZIP
function getOutputFilename(excelFilename, extension) {
  // Remover extensión .xlsx
  const baseName = excelFilename.replace(/\.xlsx$/i, '');
  // Reemplazar "reporte_" por "tickets_"
  const ticketName = baseName.replace(/^reporte_/, 'tickets_');
  return `${ticketName}.${extension}`;
}
app.post("/api/excel-to-txt", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo." });

    const buf = await excelToTxtBuffer(req.file.buffer);

    const outName = getOutputFilename(req.file.originalname, 'txt');
    const outPath = path.join(outDir, outName);
    fs.writeFileSync(outPath, buf);

    // Guardar en base de datos
    await saveFile(outName, 'txt', outPath);

    return res.download(outPath, outName);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || "Error convirtiendo Excel a TXT" });
  }
});

// -------------------------
// EXCEL -> ZIP (1 TXT por ticket)
// -------------------------
app.post("/api/excel-to-txt-zip", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo." });

    const files = await excelToTicketFiles(req.file.buffer);

    const zipName = getOutputFilename(req.file.originalname, 'zip');
    const zipPath = path.join(outDir, zipName);

    // Crear el archivo ZIP en el sistema de archivos
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(output);

    for (const f of files) {
      archive.append(f.content, { name: f.name });
    }

    await archive.finalize();

    // Esperar a que se termine de escribir
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    // Guardar en base de datos
    await saveFile(zipName, 'zip', zipPath);

    // Enviar el archivo
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    const zipStream = fs.createReadStream(zipPath);
    zipStream.pipe(res);

  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || "Error generando ZIP" });
  }
});

// -------------------------
// OBTENER LISTA DE ARCHIVOS
// -------------------------
app.get("/api/files", async (req, res) => {
  try {
    const files = await getFiles();
    return res.json({ files });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error obteniendo archivos" });
  }
});

// -------------------------
// OBTENER ARCHIVOS POR TIPO
// -------------------------
app.get("/api/files/type/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const files = await getFilesByType(type);
    return res.json({ files });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error obteniendo archivos por tipo" });
  }
});

// -------------------------
// DESCARGAR ARCHIVO POR ID
// -------------------------
app.get("/api/files/download/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const file = await getFileById(id);
    
    if (!file) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }

    // Verificar que el archivo existe en el sistema de archivos
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ error: "Archivo no existe en el sistema" });
    }

    // Descargar el archivo
    res.download(file.path, file.name);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error descargando archivo" });
  }
});

// -------------------------
// ELIMINAR ARCHIVO POR ID
// -------------------------
app.delete("/api/files/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const file = await getFileById(id);
    
    if (!file) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }

    // Eliminar el archivo del sistema de archivos si existe
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Eliminar el registro de la base de datos
    await deleteFile(id);

    return res.json({ ok: true, message: "Archivo eliminado correctamente" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error eliminando archivo" });
  }
});

// -------------------------
// LISTEN (Render usa process.env.PORT)
// -------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});
