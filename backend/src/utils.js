// backend/src/utils.js

const { eachDayOfInterval, differenceInDays } = require("date-fns");

/**
 * Devuelve array de Date entre start y end (ISO yyyy-mm-dd).
 * Si skipSundays = true, elimina domingos.
 * Si se proporcionan holidayDates (array ISO yyyy-mm-dd), también los elimina.
 */
function buildDateList(startISO, endISO, skipSundays = true, holidayDates = []) {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");

  const days = eachDayOfInterval({ start, end });

  // Crear set de fechas festivas para búsqueda O(1)
  const holidaySet = new Set(
    (holidayDates || []).map(h => new Date(h + "T00:00:00").toISOString().split('T')[0])
  );

  // Filtrar domingos y días festivos
  return days.filter((d) => {
    const dayISO = d.toISOString().split('T')[0];
    const isSunday = d.getDay() === 0;
    const isHoliday = holidaySet.has(dayISO);
    
    if (skipSundays && isSunday) return false;
    if (isHoliday) return false;
    
    return true;
  });
}

/** Formato DD/MM/YYYY para nombres de archivos */
function formatDateForFilename(dateObj) {
  const d = dateObj.getDate().toString().padStart(2, '0');
  const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const y = dateObj.getFullYear();
  return `${d}.${m}.${y}`;
}

/** Formato D/M/YYYY para filas del Excel */
function formatDateDMY(dateObj) {
  const d = dateObj.getDate();
  const m = dateObj.getMonth() + 1;
  const y = dateObj.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Redondeo a N decimales */
function roundTo(n, decimals = 2) {
  const p = 10 ** decimals;
  return Math.round((Number(n) + Number.EPSILON) * p) / p;
}

/**
 * Peso aleatorio basado en baseTon y variación %.
 * decimalsTon: cuántos decimales quieres en TON (tú quieres 2).
 */
function randomPesoTon(baseTon, variacionPct, decimalsTon = 2) {
  const base = Number(baseTon);
  const pct = Number(variacionPct);

  const factor = 1 + ((Math.random() * 2 - 1) * (pct / 100));
  const val = base * factor;

  return roundTo(val, decimalsTon);
}

/**
 * Convierte toneladas a kilogramos con 2 decimales (TON * 1000)
 * (sin forzar entero)
 */
function tonToKg(ton, decimalsKg = 2) {
  return roundTo(Number(ton) * 1000, decimalsKg);
}

/**
 * Calcula el ticket inicial considerando la brecha desde el último ticket registrado.
 * Ahora cuenta domingos y días festivos como DÍA COMPLETO (1.0) - no se generan filas pero la báscula funciona.
 * 
 * Lógica: Sábado (0.5 tarde) + Domingo festivo (1.0 día completo) + Lunes (0 mañana) = 1.5 días
 * 
 * @param {number} lastTicketNumber - Último número de ticket registrado
 * @param {string} lastTicketDate - Fecha del último ticket (ISO yyyy-mm-dd)
 * @param {string} startDate - Fecha inicio del reporte (ISO yyyy-mm-dd)
 * @param {number} spacingVariance - Espaciado entre tickets en el mismo día (base)
 * @param {number} dailyTicketCount - Cantidad de tickets por día completo (base)
 * @param {boolean} skipSundays - Si se saltan domingos
 * @param {array} holidayDates - Array de fechas festivas (ISO yyyy-mm-dd)
 * 
 * @returns {number} - El ticket number con el que comenzar
 */
function calculateInitialTicket(
  lastTicketNumber,
  lastTicketDate,
  startDate,
  spacingVariance,
  dailyTicketCount,
  skipSundays = true,
  holidayDates = []
) {
  const lastDate = new Date(lastTicketDate + "T00:00:00");
  const startDateObj = new Date(startDate + "T00:00:00");

  // Si la fecha de inicio es igual o anterior a la última registrada, 
  // continuamos desde el último ticket
  if (startDateObj <= lastDate) {
    return lastTicketNumber + spacingVariance;
  }

  // Calcular días entre último ticket y fecha de inicio
  const daysBetween = differenceInDays(startDateObj, lastDate);

  let nextTicket = Number(lastTicketNumber);

  // Crear set de fechas festivas para búsqueda O(1)
  const holidaySet = new Set(
    (holidayDates || []).map(h => new Date(h + "T00:00:00").toISOString().split('T')[0])
  );

  // Desde la fecha del último ticket (tarde = 0.5):
  // Agregamos media día de capacidad
  nextTicket += dailyTicketCount / 2;

  // Para cada día entre last y start
  for (let i = 1; i < daysBetween; i++) {
    // Verificar si es domingo o festivo
    const dayToCheck = new Date(lastDate);
    dayToCheck.setDate(dayToCheck.getDate() + i);
    
    const dayISO = dayToCheck.toISOString().split('T')[0];
    const isSunday = dayToCheck.getDay() === 0;
    const isHoliday = holidaySet.has(dayISO);

    if ((skipSundays && isSunday) || isHoliday) {
      // Día festivo/domingo: no se genera fila, pero la báscula funciona
      // Cuenta como DÍA COMPLETO de capacidad
      nextTicket += dailyTicketCount;
    } else {
      // Día normal: agregar capacidad de un día completo
      nextTicket += dailyTicketCount;
    }
  }

  // Nota: Se agregará media día más al llegar a la fecha de inicio
  // en la próxima iteración de generación

  return nextTicket;
}

/**
 * Genera un espaciado aleatorio alrededor de una varianza base.
 * Ej: spacingVariance=8, spacingVarianceRange=2 → valor entre 6 y 10
 */
function randomSpacing(spacingVariance, spacingVarianceRange) {
  const variance = Number(spacingVarianceRange);
  const min = Math.max(1, spacingVariance - variance);
  const max = spacingVariance + variance;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Genera una cantidad aleatoria de tickets por día alrededor de una base.
 * Ej: dailyTicketCount=80, dailyTicketCountRange=10 → valor entre 70 y 90
 */
function randomDailyTickets(dailyTicketCount, dailyTicketCountRange) {
  const variance = Number(dailyTicketCountRange);
  const min = Math.max(1, dailyTicketCount - variance);
  const max = dailyTicketCount + variance;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  buildDateList,
  formatDateDMY,
  formatDateForFilename,
  roundTo,
  randomPesoTon,
  tonToKg,
  calculateInitialTicket,
  randomSpacing,
  randomDailyTickets
};
