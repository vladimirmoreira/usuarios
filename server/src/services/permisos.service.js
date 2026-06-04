'use strict';

/**
 * Servicio para traducir entre los strings posicionales de Firebird
 * (PERMISOS, MOVIMIENTOS, PERMISO_GG, MENU_GG_2) y arrays de booleans
 * en JSON consumibles por el frontend.
 *
 * Convención:
 *   - PERMISOS / MOVIMIENTOS / PERMISO_GG: cada carácter = 1 permiso.
 *       'S' = habilitado, cualquier otro ('N', '0', '-', ' ') = deshabilitado.
 *   - MENU_GG_2: cada carácter en posición = '1' habilitado, '0' deshabilitado.
 */

function decodeSN(str, size = 0) {
  const s = str == null ? '' : String(str);
  const out = new Array(size).fill(false);
  for (let i = 0; i < size; i++) out[i] = (s[i] || '').toUpperCase() === 'S';
  return out;
}

function encodeSN(arr = [], size = 0) {
  let out = '';
  for (let i = 0; i < size; i++) out += arr[i] ? 'S' : 'N';
  return out;
}

function decode01(str, size = 0) {
  const s = str == null ? '' : String(str);
  const out = new Array(size).fill(false);
  for (let i = 0; i < size; i++) out[i] = s[i] === '1';
  return out;
}

function encode01(arr = [], size = 0) {
  let out = '';
  for (let i = 0; i < size; i++) out += arr[i] ? '1' : '0';
  return out;
}

/**
 * permiso_varios en USUARIO_CONCEPTO:
 *   '0' = elegido / habilitado (true)
 *   '1' = no elegido / deshabilitado (false)
 *   posición fuera de rango o carácter distinto → false
 */
const SIZE_PERMISO_VARIOS = 15;

function decodeConcepto(str, size = SIZE_PERMISO_VARIOS) {
  const s = str == null ? '' : String(str);
  const out = new Array(size).fill(false);
  for (let i = 0; i < size; i++) out[i] = s[i] === '0'; // '0' = elegido = true
  return out;
}

function encodeConcepto(arr = [], size = SIZE_PERMISO_VARIOS) {
  let out = '';
  for (let i = 0; i < size; i++) out += arr[i] ? '0' : '1'; // true→'0', false→'1'
  return out;
}

module.exports = { decodeSN, encodeSN, decode01, encode01, decodeConcepto, encodeConcepto };
