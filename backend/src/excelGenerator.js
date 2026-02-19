// backend/src/excelGenerator.js

const path = require("path");
const ExcelJS = require("exceljs");
const { buildDateList, formatDateDMY, formatDateForFilename, randomPesoTon, tonToKg, roundTo, calculateInitialTicket, randomSpacing, randomDailyTickets } = require("./utils");
const { differenceInDays } = require("date-fns");

/**
 * Genera filas de tickets según:
 * - rango fechas (saltando domingos si aplica)
 * - conductores activos
 * - ticketsPorDia por conductor
 * - horarios rotativos (si ticketsPorDia > horarios.length, repite)
 * - tickets con espaciado inteligente basado en brecha de tiempo
 *
 * CAMBIOS CLAVE:
 * - TODO a 2 decimales en peso/tara/kg
 * - KG NETO = TON*1000 (2 dec)
 * - KG BRUTO = KG NETO + TARA (2 dec)
 * - Formatos numéricos Excel (0.00) para columnas 7 a 10
 * - Nuevo sistema de numeración de tickets basado en espaciado
 */
async function generateExcel({
  config,
  startDateISO,
  endDateISO,
  lastTicketNumber,
  lastTicketDate,
  spacingVariance,
  spacingVarianceRange,
  dailyTicketCount,
  dailyTicketCountRange,
  outputName
}) {
  const { company, rules } = config;

  const drivers = (config.drivers || []).filter((d) => d.activo);
  if (!drivers.length) {
    throw new Error("No hay conductores activos. Activa o agrega al menos uno.");
  }

  const skipSundays = Boolean(config?.rules?.skipSundays ?? true);
  const dates = buildDateList(startDateISO, endDateISO, skipSundays);

  // Calcular el ticket inicial considerando la brecha
  let ticket = calculateInitialTicket(
    Number(lastTicketNumber),
    lastTicketDate,
    startDateISO,
    Number(spacingVariance),
    Number(dailyTicketCount),
    skipSundays
  );

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Reporte");

  // ✅ Título (12 columnas -> A:L)
  // usar T00:00:00 para evitar desplazamiento por zona horaria
  const titleText = `CONTROL DE RESIDUOS (${formatDateForFilename(new Date(startDateISO + "T00:00:00"))} - ${formatDateForFilename(new Date(endDateISO + "T00:00:00"))})`;
  ws.mergeCells("A1:L1");
  ws.getCell("A1").value = titleText;
  ws.getCell("A1").font = { size: 16, bold: true };
  ws.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

  ws.addRow([]);

  // Encabezados
  const headers = [
    "FECHA PESADA",
    "CHOFER",
    "PLACAS",
    "HORARIO",
    "TICKET",
    "BASCULA CERTIFICADA",
    "PESO PRODUCTO (TON)",
    "TARA (KG)",
    "KG NETO",
    "KG BRUTO",
    "PRECIO POR TON",
    "TOTAL"
  ];
  ws.addRow(headers);

  const headerRow = ws.getRow(ws.lastRow.number);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center" };

  // Column widths (12)
  ws.columns = [
    { width: 14 },
    { width: 18 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 20 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 14 }
  ];

  // ✅ FORZAMOS 2 DECIMALES en TON y KG
  const decimalsTon = 2;
  const decimalsKg = 2;

  for (const dateObj of dates) {
    // Agregar media día al cambiar de día (excepto el primero)
    if (dateObj > new Date(startDateISO + "T00:00:00")) {
      const dailyTickets = randomDailyTickets(Number(dailyTicketCount), Number(dailyTicketCountRange));
      ticket += dailyTickets / 2;
    }

    for (const d of drivers) {
      const perDay = Number(d.ticketsPorDia) || 0;
      if (perDay <= 0) continue;

      for (let i = 0; i < perDay; i++) {
        const horario = (d.horarios && d.horarios.length)
          ? d.horarios[i % d.horarios.length]
          : "";

        // ✅ Agregar espaciado aleatorio al ticket actual
        const spacing = randomSpacing(Number(spacingVariance), Number(spacingVarianceRange));
        ticket += spacing;

        // ✅ TON con 2 decimales
        const pesoTon = randomPesoTon(
          Number(d.pesoBaseTon),
          Number(d.variacionPct),
          decimalsTon
        );

        // ✅ TARA con 2 decimales (aunque venga entero)
        // TARA viene en TON → convertir a KG
        const taraKg = tonToKg(Number(d.taraKg), decimalsKg);

        // ✅ KG NETO = TON * 1000 (2 decimales)
        const kgNeto = tonToKg(pesoTon, decimalsKg);

        // ✅ KG BRUTO = TARA + NETO (2 decimales)
        const kgBruto = roundTo(taraKg + kgNeto, decimalsKg);

        // Precio y total (2 decimales)
        const precioTon = roundTo(Number(company.precioPorTon), 2);
        const total = roundTo(pesoTon * precioTon, 2);

        ws.addRow([
          formatDateDMY(dateObj),
          d.nombre,
          d.placas,
          horario,
          Math.floor(ticket), // Convertir a entero
          company.basculaCertificada,
          pesoTon,
          taraKg,
          kgNeto,
          kgBruto,
          precioTon,
          total
        ]);
      }
    }
  }

  // ✅ FORMATOS NUMÉRICOS
  // Title row 1, blank row 2, headers row 3 -> data starts row 4
  const firstDataRow = 4;

  for (let r = firstDataRow; r <= ws.lastRow.number; r++) {
    // PESO TON (col 7) -> 0.00
    ws.getRow(r).getCell(7).numFmt = "0.00";

    // TARA, KG NETO, KG BRUTO (col 8,9,10) -> 0.00
    ws.getRow(r).getCell(8).numFmt = "0.00";
    ws.getRow(r).getCell(9).numFmt = "0.00";
    ws.getRow(r).getCell(10).numFmt = "0.00";

    // PRECIO, TOTAL (col 11,12) -> $0.00
    ws.getRow(r).getCell(11).numFmt = '"$"#,##0.00';
    ws.getRow(r).getCell(12).numFmt = '"$"#,##0.00';
  }

  const outPath = path.join(__dirname, "..", "output", outputName);
  await workbook.xlsx.writeFile(outPath);

  return outPath;
}

module.exports = { generateExcel };
