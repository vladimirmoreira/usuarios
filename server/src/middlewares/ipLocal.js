'use strict';

/**
 * Candado de red local para el portal público de auto-reset (/api/publico/*).
 *
 * Solo permite peticiones cuya IP de origen sea de la red local (loopback o
 * rangos privados RFC1918/link-local/ULA), o que coincida con la allowlist
 * explícita de env.RESET_PORTAL_IPS (IPs exactas o prefijos, coma-separados).
 *
 * IMPORTANTE (seguridad): la IP se toma de `X-Real-IP` (que nginx fija con
 * `proxy_set_header X-Real-IP $remote_addr`, sobrescribiendo cualquier valor
 * del cliente → no falsificable). Si no está (dev sin nginx) se cae a `req.ip`.
 * NO se usa `x-client-ip` ni el X-Forwarded-For crudo porque el cliente puede
 * inyectarlos y saltarse el candado.
 */

const env = require('../config/env');
const logger = require('../utils/logger');

/** Normaliza la IP: quita el prefijo IPv4-mapped-IPv6 (::ffff:) y espacios. */
function normalizar(ip) {
  if (!ip) return '';
  let s = String(ip).trim().toLowerCase();
  if (s.startsWith('::ffff:')) s = s.slice(7);
  return s;
}

/** true si la IP pertenece a loopback o a un rango privado/local. */
function esLocal(ip) {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (/^10\./.test(ip)) return true;                       // 10.0.0.0/8
  if (/^192\.168\./.test(ip)) return true;                 // 192.168.0.0/16
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true; // 172.16.0.0/12
  if (/^127\./.test(ip)) return true;                      // loopback
  if (/^169\.254\./.test(ip)) return true;                 // link-local IPv4
  if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true;          // ULA IPv6 (fc00::/7)
  if (/^fe80:/.test(ip)) return true;                      // link-local IPv6
  return false;
}

// Allowlist explícita opcional (IPs exactas o prefijos, p. ej. "203.0.113.").
const ALLOW = (env.RESET_PORTAL_IPS || '')
  .split(',')
  .map((s) => normalizar(s))
  .filter(Boolean);

module.exports = function ipLocal(req, res, next) {
  const ip = normalizar(req.headers['x-real-ip'] || req.ip);
  const permitido =
    esLocal(ip) || ALLOW.some((a) => ip === a || (a && ip.startsWith(a)));
  if (!permitido) {
    logger.warn({ ip, path: req.originalUrl }, 'portal reset: IP no local rechazada');
    return res.status(403).json({ error: 'Acceso restringido a la red local del servidor.' });
  }
  next();
};
