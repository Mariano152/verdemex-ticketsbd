const ExcelJS = require("exceljs");

function fmtIntComma(n) {
  const x = Math.round(Number(n) || 0);
  return x.toLocaleString("en-US"); // 14910 -> "14,910"
}

// Convierte valor excel a "DD/MM/YYYY HH:mm:ss"
function excelDateToDMYHMS(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yyyy = value.getFullYear();
    const hh = String(value.getHours()).padStart(2, "0");
    const mi = String(value.getMinutes()).padStart(2, "0");
    const ss = String(value.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
  }

  if (typeof value === "number") {
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);

    const fractionalDay = value - Math.floor(value);
    const totalSeconds = Math.round(fractionalDay * 86400);

    const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const mi = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");

    const dd = String(dateInfo.getUTCDate()).padStart(2, "0");
    const mm = String(dateInfo.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = dateInfo.getUTCFullYear();

    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
  }

  return String(value);
}

function buildTicketText(row) {
  const { ticket, fechaStr, chofer, placas, taraKg, kgNeto, kgBruto } = row;

  const brutoTxt = fmtIntComma(kgBruto);
  const taraTxt = fmtIntComma(taraKg);
  const netoTxt = fmtIntComma(kgNeto);

  return (
`BASCULA PUBLICA COYULA
PERIFERICO ORIENTE 7390
COYULA, JALISCO
CP:45400 Tels:3319853306
RFC:


Sucursal:  COYULA
Expedido en:  JALISCO

TKT A    ${ticket}
Fecha:   ${fechaStr}
OPERADOR AMERICA
Codigo:Cantidad:Precio:Importe:
Alm. Descripcion del producto:


KG BRUTO ${brutoTxt} 0.00
----------------------------------------
KG TARA  ${taraTxt}  0.00
----------------------------------------
KG NETO  ${netoTxt}  0.00


TORTON $100.00 1 $100.00 $100.00

Total :        $100.00


CIEN PESOS 00/100 M.N.
Comprobante no deducible de impuestos


Observaciones:


VERDEMEX      
PLACAS: ${placas}   CHOFER:${chofer}
CARGA: BASURA ORG
Gracias por su compra
`
  );
}

async function parseExcelRows(excelBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(excelBuffer);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("El Excel no tiene hojas.");

  // Buscar encabezados (fila donde A = FECHA PESADA)
  let headerRowNum = null;
  for (let r = 1; r <= 20; r++) {
    const v = String(ws.getRow(r).getCell(1).value || "").trim().toUpperCase();
    if (v === "FECHA PESADA") {
      headerRowNum = r;
      break;
    }
  }
  if (!headerRowNum) throw new Error("No encontré encabezados. Esperaba 'FECHA PESADA' en columna A.");

  const headerRow = ws.getRow(headerRowNum);
  const map = {};
  headerRow.eachCell((cell, colNumber) => {
    const key = String(cell.value || "").trim().toUpperCase();
    if (key) map[key] = colNumber;
  });

  const colFecha = map["FECHA PESADA"];
  const colChofer = map["CHOFER"];
  const colPlacas = map["PLACAS"];
  const colTicket = map["TICKET"];
  const colTara = map["TARA (KG)"];
  const colNeto = map["KG NETO"];
  const colBruto = map["KG BRUTO"];

  const missing = [];
  if (!colFecha) missing.push("FECHA PESADA");
  if (!colChofer) missing.push("CHOFER");
  if (!colPlacas) missing.push("PLACAS");
  if (!colTicket) missing.push("TICKET");
  if (!colTara) missing.push("TARA (KG)");
  if (!colNeto) missing.push("KG NETO");
  if (!colBruto) missing.push("KG BRUTO");
  if (missing.length) throw new Error("Faltan columnas en el Excel: " + missing.join(", "));

  const rows = [];
  const startDataRow = headerRowNum + 1;

  for (let r = startDataRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const ticketVal = row.getCell(colTicket).value;
    if (ticketVal === null || ticketVal === undefined || ticketVal === "") continue;

    const fechaVal = row.getCell(colFecha).value;
    const fechaStr = excelDateToDMYHMS(fechaVal);

    const chofer = String(row.getCell(colChofer).value || "").trim().toUpperCase();
    const placas = String(row.getCell(colPlacas).value || "").trim().toUpperCase();

    const taraKg = Number(row.getCell(colTara).value || 0);
    const kgNeto = Number(row.getCell(colNeto).value || 0);
    const kgBruto = Number(row.getCell(colBruto).value || 0);

    rows.push({
      ticket: String(ticketVal).trim(),
      fechaStr,
      chofer,
      placas,
      taraKg,
      kgNeto,
      kgBruto
    });
  }

  if (!rows.length) throw new Error("No encontré filas con TICKET.");
  return rows;
}

// TXT único (todo junto)
async function excelToTxtBuffer(excelBuffer) {
  const rows = await parseExcelRows(excelBuffer);
  const out = rows.map(buildTicketText).join("\n\n");
  return Buffer.from(out, "utf-8");
}

// Varios TXTs (uno por ticket)
async function excelToTicketFiles(excelBuffer) {
  const rows = await parseExcelRows(excelBuffer);
  return rows.map(r => {
    const name = `TKT_${r.ticket}_${r.placas || "SINPLACAS"}.txt`.replace(/[^\w.\-]/g, "_");
    const content = buildTicketText(r);
    return { name, content };
  });
}

module.exports = { excelToTxtBuffer, excelToTicketFiles };
