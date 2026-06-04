'use strict';

const HistorialModel = require('../models/historial.model');
const logger = require('./logger');
const { OP } = require('../config/operaciones.config');

/**
 * Registra un evento en HISTORIAL_USUARIO de forma best-effort.
 * NUNCA lanza: la auditoría no debe bloquear la operación de negocio.
 *
 * @param {object}   req           - request Express (para tomar `req.user.iduser`) o `{user:{iduser}}`.
 * @param {string}   iduser        - usuario destinatario de la acción.
 * @param {number}   idoperacion   - código de TIPO_OPERACION.
 * @param {string?}  observacion   - descripción opcional.
 */
async function auditar(req, iduser, idoperacion, observacion = null) {
  try {
    const rptUser = req?.user?.iduser || 'SYSTEM';
    await HistorialModel.registrar({ iduser, idoperacion, rptUser, observacion });
  } catch (e) {
    // No volver a lanzar; sólo loguear (best-effort)
    logger.warn({ err: e?.message, iduser, idoperacion }, 'audit failed');
  }
}

/** Versión que NO requiere `req`: se usa desde servicios con rptUser explícito. */
async function auditarDirecto({ iduser, idoperacion, rptUser, observacion = null }) {
  try {
    await HistorialModel.registrar({ iduser, idoperacion, rptUser, observacion });
  } catch (e) {
    logger.warn({ err: e?.message, iduser, idoperacion }, 'audit failed');
  }
}

module.exports = { auditar, auditarDirecto, OP };
