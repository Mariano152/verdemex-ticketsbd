const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const archiver = require("archiver");

const { generateExcel } = require("./excelGenerator");
const { loadConfig, saveConfig } = require("./configStore");
const { excelToTxtBuffer, excelToTicketFiles } = require("./excelToTxt");

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
        reportTitle: "REPORTE MENSUAL",
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
    const { startDate, endDate, ticketInicial, config } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Falta startDate o endDate" });
    }
    if (ticketInicial === undefined || ticketInicial === null || ticketInicial === "") {
      return res.status(400).json({ error: "Falta ticketInicial" });
    }
    if (!config || typeof config !== "object") {
      return res.status(400).json({ error: "Falta config en el body" });
    }

    const fileName = `reporte_${Date.now()}.xlsx`;
    const filePath = await generateExcel({
      config,
      startDateISO: startDate,
      endDateISO: endDate,
      ticketInicial: Number(ticketInicial),
      outputName: fileName,
    });

    return res.download(filePath);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || "Error generando excel" });
  }
});

// -------------------------
// EXCEL -> TXT ÚNICO
// -------------------------
app.post("/api/excel-to-txt", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo." });

    const buf = await excelToTxtBuffer(req.file.buffer);

    const outName = `tickets_${Date.now()}.txt`;
    const outPath = path.join(outDir, outName);
    fs.writeFileSync(outPath, buf);

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

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="tickets_${Date.now()}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(res);

    for (const f of files) {
      archive.append(f.content, { name: f.name });
    }

    await archive.finalize();
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || "Error generando ZIP" });
  }
});

// -------------------------
// LISTEN (Render usa process.env.PORT)
// -------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});
