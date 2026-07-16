'use strict';

/** Utilidades de franja horaria de ingreso (compartidas por login y middleware). */
const TZ = process.env.TZ || 'America/Asuncion';

/** Hora actual "HH:MM" en la zona horaria configurada. */
function horaActual() {
  return new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour12: false }).slice(0, 5);
}

/** ¿`now` (HH:MM) cae dentro de [ini, fin]? Soporta franjas que cruzan medianoche. */
function dentroFranja(now, ini, fin) {
  if (!ini || !fin) return true; // sin franja = sin restricción
  return ini <= fin ? (now >= ini && now <= fin) : (now >= ini || now <= fin);
}

module.exports = { TZ, horaActual, dentroFranja };
