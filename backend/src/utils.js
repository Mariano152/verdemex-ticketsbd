// backend/src/utils.js

const { eachDayOfInterval } = require("date-fns");

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

/** Formato D/M/YYYY */
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

module.exports = {
  buildDateList,
  formatDateDMY,
  roundTo,
  randomPesoTon,
  tonToKg
};
