// backend/src/utils.js

const { eachDayOfInterval, differenceInDays } = require("date-fns");

/**
 * Devuelve array de Date entre start y end (ISO yyyy-mm-dd).
 * Si skipSundays = true, elimina domingos.
 */
function buildDateList(startISO, endISO, skipSundays = true) {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");

  const days = eachDayOfInterval({ start, end });

  if (!skipSundays) return days;

  // Domingo = 0
  return days.filter((d) => d.getDay() !== 0);
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
 * 
 * @param {number} lastTicketNumber - Último número de ticket registrado
 * @param {string} lastTicketDate - Fecha del último ticket (ISO yyyy-mm-dd)
 * @param {string} startDate - Fecha inicio del reporte (ISO yyyy-mm-dd)
 * @param {number} spacingVariance - Espaciado entre tickets en el mismo día (base)
 * @param {number} dailyTicketCount - Cantidad de tickets por día completo (base)
 * @param {boolean} skipSundays - Si se saltan domingos
 * 
 * @returns {number} - El ticket number con el que comenzar
 */
function calculateInitialTicket(
  lastTicketNumber,
  lastTicketDate,
  startDate,
  spacingVariance,
  dailyTicketCount,
  skipSundays = true
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

  // Desde la fecha del último ticket (0.5 day):
  // Agregamos media día de capacidad
  nextTicket += dailyTicketCount / 2;

  // Para cada día completo entre last y start (excluyendo el último)
  for (let i = 1; i < daysBetween; i++) {
    // Verificar si es domingo y si se debe saltar
    const dayToCheck = new Date(lastDate);
    dayToCheck.setDate(dayToCheck.getDate() + i);
    
    if (skipSundays && dayToCheck.getDay() === 0) {
      // No agregar tickets para domingo
      continue;
    }
    
    // Agregar capacidad de un día completo
    nextTicket += dailyTicketCount;
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
