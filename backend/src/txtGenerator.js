const ExcelJS = require("exceljs");

function fmtIntWithCommas(n) {
  const num = Math.round(Number(n || 0));
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function cellToText(v) {
  if (v == null) return "";
  if (typeof v === "object" && v.text) return String(v.text);
  return String(v);
}

function formatDateTimeFromExcel(v) {
  // Si ya viene como string "01/12/2025 11:53:04", lo devolvemos igual
  const s = cellToText(v).trim();
  if (s && /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/.test(s)) return s;

  // Si ExcelJS lo trae como Date:
  if (v instanceof Date) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const yyyy = v.getFullYear();
    const hh = String(v.getHours()).padStart(2, "0");
    const mi = String(v.getMinutes()).padStart(2, "0");
    const ss = String(v.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
  }

  // Si viene con formato raro, lo dejamos como texto tal cual
  return s;
}

function normalizeHeader(h) {
  return cellToText(h)
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "");
}

function findHeaderMap(ws) {
  // Busca la primera fila que tenga varios textos (headers)
  // y arma un map: HEADER_NORMALIZADO -> columnIndex
  for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
    const row = ws.getRow(r);
    const values = row.values || [];
    let textCells = 0;

    for (let c = 1; c < values.length; c++) {
      const t = cellToText(values[c]).trim();
      if (t) textCells++;
    }

    if (textCells >= 5) {
      const map = {};
      for (let c = 1; c < values.length; c++) {
        const h = normalizeHeader(values[c]);
        if (h) map[h] = c;
      }
      return { headerRow: r, map };
    }
  }
  return { headerRow: null, map: {} };
}

function getCol(map, candidates) {
  // candidates: lista de headers posibles
  for (const key of candidates) {
    const k = normalizeHeader(key);
    if (map[k]) return map[k];
  }
  return null;
}

/**
 * Convierte Excel -> TXT tickets (1 ticket por fila)
 */
async function excelToTxtBuffer(excelBuffer, config = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);

  const ws = workbook.worksheets[0];
  if (!ws) throw new Error("El Excel no tiene hojas.");

  // Header fijo (puedes moverlo a config.json si quieres)
  const header = {
    title: "BASCULA PUBLICA COYULA",
    line1: "PERIFERICO ORIENTE 7390",
    line2: "COYULA, JALISCO",
    line3: "CP: 45400  Tels:  33 1985 3306",
    rfc: "RFC:",
    sucursal: "COYULA",
    expedidoEn: "JALISCO",
    empresa: "VERDEMEX",
    carga: "BASURA ORG",
    thanks: "Gracias por su compra :"
  };

  // Detectar headers
  const { headerRow, map } = findHeaderMap(ws);

  // Columnas por encabezado (si tu Excel trae estos nombres, agarra perfecto)
  const colTicket = getCol(map, ["TICKET", "TKT", "TKT A", "FOLIO", "TICKET ID"]);
  const colFecha = getCol(map, ["FECHA", "FECHA PESADA", "FECHA/HORA", "FECHA HORA", "DATETIME", "TIMESTAMP"]);
  const colChofer = getCol(map, ["CHOFER", "OPERADOR", "NOMBRE", "DRIVER"]);
  const colPlacas = getCol(map, ["PLACAS", "PLACA", "VEHICULO", "VEHÍCULO"]);
  const colTara = getCol(map, ["TARA", "TARA KG", "KG TARA", "TARA (KG)", "TARA_KG"]);
  const colNeto = getCol(map, ["KG NETO", "NETO", "PESO NETO", "NETO KG"]);
  const colBruto = getCol(map, ["KG BRUTO", "BRUTO", "PESO BRUTO", "BRUTO KG"]);

  // Fallback si no hay headers: usa posiciones típicas del reporte
  // A FECHA, B CHOFER, C PLACAS, E TICKET, H TARA, I NETO, J BRUTO
  const fallback = {
    ticket: 5,
    fecha: 1,
    chofer: 2,
    placas: 3,
    tara: 8,
    neto: 9,
    bruto: 10
  };

  const startRow = headerRow ? headerRow + 1 : 2;

  const out = [];

  for (let r = startRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);

    const ticketV = row.getCell(colTicket || fallback.ticket).value;
    const fechaV = row.getCell(colFecha || fallback.fecha).value;
    const choferV = row.getCell(colChofer || fallback.chofer).value;
    const placasV = row.getCell(colPlacas || fallback.placas).value;
    const taraV = row.getCell(colTara || fallback.tara).value;
    const netoV = row.getCell(colNeto || fallback.neto).value;
    const brutoV = row.getCell(colBruto || fallback.bruto).value;

    const ticket = cellToText(ticketV).trim();
    if (!ticket) continue;

    const fechaTxt = formatDateTimeFromExcel(fechaV);
    const chofer = cellToText(choferV).trim().toUpperCase();
    const placas = cellToText(placasV).trim().toUpperCase();

    // SIN .00, con coma
    const tara = fmtIntWithCommas(taraV);
    const neto = fmtIntWithCommas(netoV);
    const bruto = fmtIntWithCommas(brutoV);

    const block = [
      header.title,
      header.line1,
      header.line2,
      header.line3,
      header.rfc,
      "",
      `Sucursal:  ${header.sucursal}`,
      `Expedido en:  ${header.expedidoEn}`,
      "",
      `TKT A        ${ticket}`,
      `Fecha:   ${fechaTxt}`,
      `OPERADOR ${chofer}`,
      "Codigo: Cantidad:  Precio:  Importe:",
      "Alm. Descripcion del producto:",
      "",
      `KG BRUTO        ${bruto}        0.00`,
      "----------------------------------------",
      `KG TARA         ${tara}        0.00`,
      "----------------------------------------",
      `KG NETO         ${neto}        0.00`,
      "",
      "",
      "TORTON $100.00  1  $100.00   $100.00",
      "",
      "Total :                $100.00",
      "",
      "CIEN PESOS 00/100 M.N.",
      "Comprobante no deducible de impuestos",
      "Observaciones:",
      "",
      "",
      `${header.empresa}      `,
      `PLACAS: ${placas}   CHOFER:${chofer}`,
      `CARGA: ${header.carga}`,
      header.thanks
    ].join("\n");

    out.push(block);
    out.push("\n\n"); // separación entre tickets
  }

  return Buffer.from(out.join(""), "utf-8");
}

module.exports = { excelToTxtBuffer };
