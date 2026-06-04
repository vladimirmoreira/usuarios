'use strict';

/**
 * Orquestador de Operaciones de Usuario.
 *
 * Reemplaza a los SP legacy PCD_USUARIO y PCD_OPERACIONES.
 * Cada m\u00e9todo se corresponde con una operaci\u00f3n del cat\u00e1logo
 * (config/operaciones.config.js) y delega en OperacionesModel para las
 * queries at\u00f3micas. La replicaci\u00f3n a MASTER se gestiona aqu\u00ed con
 * MasterSyncService (best-effort, nunca bloquea).
 *
 * Mejoras vs. legacy:
 *   - Sin EXECUTE STATEMENT ON EXTERNAL: el routing lo hace el pool de Node.
 *   - Sin tablas TMP$*: las reasignaciones se ordenan en memoria.
 *   - Transacciones expl\u00edcitas por sub-flujo.
 *   - Auditor\u00eda granular: cada sub-tarea registra HISTORIAL_USUARIO con detalle.
 *   - BAJA y REACTIVAR propagan estado a MASTER (el SP no lo hac\u00eda).
 *   - CAMBIO_PERFIL es un UPDATE directo (sin PCD_ACTUALIZA_PERFIL).
 */

const OperacionesModel = require('../models/operaciones.model');
const MasterSyncService = require('./masterSync.service');
const { auditarDirecto } = require('../utils/audit');
const { transaction } = require('../config/firebird');
const { OP, OP_BY_ID } = require('../config/operaciones.config');
const logger = require('../utils/logger');

const CLAVE_DEFECTO = '12345678901234567890';

/**
 * Construye el texto del BLOB de observación para HISTORIAL_USUARIO.
 * Cada línea representa una tabla/acción ejecutada, prefijada con "> ".
 * Se almacena como un único registro separado por \n.
 */
function buildDetalle(lines) {
  return lines.filter(Boolean).map((l) => `> ${l}`).join('\n');
}

/** Helper de auditor\u00eda con descripci\u00f3n autom\u00e1tica del cat\u00e1logo. */
async function audit({ iduser, idoperacion, rptUser, observacion }) {
  const desc = OP_BY_ID[idoperacion]?.descripcion || 'Operaci\u00f3n';
  await auditarDirecto({
    iduser,
    idoperacion,
    rptUser: rptUser || 'SYSTEM',
    observacion: observacion ? `${desc}: ${observacion}` : desc,
  });
}

/** Carga del contexto (flags) por IP del cliente. */
async function cargarContexto(ip) {
  const c = await OperacionesModel.contextoPorIp(ip);
  return {
    ip,
    legajo:        Number(c.legajo) === 1,
    biometrico:    Number(c.biometrico) === 1,
    gastronomia:   Number(c.gastronomia) === 1,
    contabilidad:  Number(c.contabilidad) === 1,
    talento_humano:Number(c.talento_humano) === 1,
  };
}

/** Lanza una replicaci\u00f3n best-effort (no espera por defecto). */
function replicarMaster(iduser, { ip, claveNueva } = {}) {
  MasterSyncService.syncUsuario(iduser, { ip, claveNueva }).catch((err) => {
    logger.warn({ err: err?.message, iduser }, 'masterSync failed (best-effort)');
  });
}

const OperacionesService = {
  /** Dispatcher: ejecuta la operaci\u00f3n correspondiente al id. */
  async ejecutar(idoperacion, ctx) {
    switch (Number(idoperacion)) {
      case OP.ALTA:                return this.altaUsuario(ctx);
      case OP.BAJA:                return this.bajaUsuario(ctx);
      case OP.RESET_CLAVE:         return this.resetClave(ctx);
      case OP.ELIMINAR_HUELLA:     return this.eliminarHuella(ctx);
      case OP.REASIGNAR_SUCURSAL:  return this.reasignarSucursal(ctx);
      case OP.CAMBIO_PERFIL:       return this.cambiarPerfil(ctx);
      case OP.ACTUALIZAR_CUENTA:   return this.actualizarCuenta(ctx);
      case OP.VINCULAR_LEGAJO:     return this.vincularLegajo(ctx);
      case OP.EXCLUIR_CUENTA:      return this.excluirCuenta(ctx);
      case OP.MIGRAR_DATOS:        return this.migrarDatos(ctx);
      case OP.REACTIVAR:           return this.reactivar(ctx);
      default: {
        const e = new Error(`Operaci\u00f3n ${idoperacion} no soportada`);
        e.status = 400;
        throw e;
      }
    }
  },

  // ===========================================================================
  // OP 1 \u2014 ALTA DE USUARIO
  // ===========================================================================
  async altaUsuario(ctx) {
    const { iduser, idperfil, nombre, apellido, documento, idsucursal, rptUser, ip } = ctx;

    // Validaciones previas
    if (await OperacionesModel.existeUsuario(iduser)) {
      const e = new Error('El usuario ya existe'); e.status = 400; throw e;
    }
    const tpl = await OperacionesModel.perfilTemplate(idperfil);
    if (!tpl?.iduser) {
      const e = new Error('Perfil inexistente o sin plantilla'); e.status = 400; throw e;
    }
    if (!await OperacionesModel.sucursalActiva(idsucursal)) {
      const e = new Error('Sucursal inv\u00e1lida o inactiva'); e.status = 400; throw e;
    }
    const flags = await cargarContexto(ip);

    // Alta completa (USUARIO + USUARIOEMPRESA + MENU + sucursal/dep\u00f3sitos/conceptos)
    await OperacionesModel.altaCompleta({
      iduser, idperfil, nombre, apellido, documento, idsucursal,
      templateIduser: tpl.iduser,
    });
    await audit({ iduser, idoperacion: OP.ALTA, rptUser,
      observacion: `Perfil=${idperfil} Suc=${idsucursal} Doc=${documento}` });

    // RH \u2014 vincular legajo si LEGAJO=1 y existe persona/cargo
    if (flags.legajo) {
      const cargo = await OperacionesModel.cargoActivoPorDocumento(documento);
      if (cargo?.idcargo && !cargo.user_system) {
        await OperacionesModel.asignarUserSystemAlCargo(cargo.idcargo, iduser);
        await audit({ iduser, idoperacion: OP.ALTA, rptUser,
          observacion: `Legajo vinculado al cargo ${cargo.idcargo}` });
      }
    }

    // PDV \u2014 dar de alta como mesero si GASTRONOMIA=1 y perfil tipo=1
    if (flags.gastronomia && Number(tpl.tipo) === 1) {
      const cargo = flags.legajo ? await OperacionesModel.cargoActivoPorDocumento(documento) : null;
      await OperacionesModel.insertarMesero({
        nombre, apellido, documento, idperfil,
        idpersona: cargo?.idpersona ?? null,
        idsucursal, iduser,
        idcargo: cargo?.idcargo ?? null,
      });
      await audit({ iduser, idoperacion: OP.ALTA, rptUser,
        observacion: 'Alta GG_MESERO (gastronom\u00eda)' });
    }

    // MASTER \u2014 replicar si rol.master = 1
    replicarMaster(iduser, { ip });

    return { ok: true, mensaje: 'EXITOSO' };
  },

  // ===========================================================================
  // IMPORTACIÓN MASIVA — alta atómica (todo o nada en system DB)
  // ===========================================================================
  /**
   * @param {Array<{fila,iduser,nombre,apellido,documento,idperfil,perfilDesc,idsucursal}>} batch
   * @param {{rptUser:string, ip:string}} ctx
   * @returns {{importados: Array, erroresPostefecto: Array}}
   */
  async altasBatch(batch, { rptUser, ip }) {
    // Cargar contexto y templates una sola vez
    const flags = await cargarContexto(ip);
    const tplMap = new Map();
    for (const p of batch) {
      const tpl = await OperacionesModel.perfilTemplate(p.idperfil);
      if (!tpl?.iduser) {
        const e = new Error(`Perfil id=${p.idperfil} sin plantilla configurada`);
        e.status = 400; throw e;
      }
      tplMap.set(p.fila, tpl);
    }

    // ── Transacción atómica en system DB ────────────────────────────────────
    // Si cualquier INSERT falla, ROLLBACK de todo el lote.
    let procesamientoFalla = null;
    await transaction('system', async (tx) => {
      for (const p of batch) {
        const tpl = tplMap.get(p.fila);
        try {
          await OperacionesModel.altaCompletaEnTx(tx, {
            iduser: p.iduser, idperfil: p.idperfil,
            nombre: p.nombre, apellido: p.apellido,
            documento: p.documento, idsucursal: p.idsucursal,
            templateIduser: tpl.iduser,
          });
        } catch (e) {
          // Enriquecer con contexto del usuario y forzar rollback
          const wrapped = new Error(`Fila ${p.fila} (${p.iduser}): ${e.message}`);
          wrapped.fila   = p.fila;
          wrapped.iduser = p.iduser;
          procesamientoFalla = wrapped;
          throw wrapped;
        }
      }
    });

    // ── Post-effects (best-effort, fuera de la tx principal) ────────────────
    const erroresPostefecto = [];
    for (const p of batch) {
      const tpl = tplMap.get(p.fila);
      try {
        await audit({ iduser: p.iduser, idoperacion: OP.ALTA, rptUser,
          observacion: `Perfil=${p.idperfil} Suc=${p.idsucursal} Doc=${p.documento} [lote]` });

        if (flags.legajo) {
          const cargo = await OperacionesModel.cargoActivoPorDocumento(p.documento);
          if (cargo?.idcargo && !cargo.user_system) {
            await OperacionesModel.asignarUserSystemAlCargo(cargo.idcargo, p.iduser);
            await audit({ iduser: p.iduser, idoperacion: OP.ALTA, rptUser,
              observacion: `Legajo vinculado al cargo ${cargo.idcargo}` });
          }
        }

        if (flags.gastronomia && Number(tpl.tipo) === 1) {
          const cargo = flags.legajo
            ? await OperacionesModel.cargoActivoPorDocumento(p.documento) : null;
          await OperacionesModel.insertarMesero({
            nombre: p.nombre, apellido: p.apellido, documento: p.documento,
            idperfil: p.idperfil, idpersona: cargo?.idpersona ?? null,
            idsucursal: p.idsucursal, iduser: p.iduser, idcargo: cargo?.idcargo ?? null,
          });
          await audit({ iduser: p.iduser, idoperacion: OP.ALTA, rptUser,
            observacion: 'Alta GG_MESERO (gastronomía) [lote]' });
        }

        replicarMaster(p.iduser, { ip });
      } catch (postErr) {
        logger.warn({ err: postErr.message, iduser: p.iduser }, 'altasBatch post-effect error');
        erroresPostefecto.push({ fila: p.fila, iduser: p.iduser, mensaje: postErr.message });
      }
    }

    const importados = batch.map((p) => ({
      iduser: p.iduser, nombre: p.nombre, apellido: p.apellido,
      documento: p.documento, perfil: p.perfilDesc, idsucursal: p.idsucursal,
    }));
    return { importados, erroresPostefecto };
  },

  // ===========================================================================
  // OP 2 — BAJA
  // ===========================================================================
  async bajaUsuario(ctx) {
    const { iduser, rptUser, ip } = ctx;
    const u = await OperacionesModel.estadoUsuario(iduser);
    if (!u) { const e = new Error('Usuario no encontrado'); e.status = 404; throw e; }
    if (Number(u.estado) === 0) {
      return { ok: true, mensaje: 'EXITOSO', detalle: 'Ya estaba en baja' };
    }
    const flags = await cargarContexto(ip);

    const d = [];
    await OperacionesModel.cambiarEstadoUsuario(iduser, 0);
    d.push('[system] UPDATE USUARIO.estado=0');

    if (flags.gastronomia) {
      const n = await OperacionesModel.desactivarMesero(iduser);
      if (n) d.push('[server] UPDATE GG_MESERO.estado=0');
    }
    if (flags.biometrico && u.documento) {
      const r = await OperacionesModel.eliminarHuella(u.documento);
      if (r.borradas) d.push(`[server] DELETE RH_CARGO_BIO (${r.borradas} cargo/s)`);
    }

    replicarMaster(iduser, { ip });
    await audit({ iduser, idoperacion: OP.BAJA, rptUser, observacion: buildDetalle(d) });
    return { ok: true, mensaje: 'EXITOSO' };
  },

  // ===========================================================================
  // OP 3 \u2014 RESET DE CLAVE
  // ===========================================================================
  async resetClave(ctx) {
    const { iduser, rptUser, ip } = ctx;
    const u = await OperacionesModel.estadoUsuario(iduser);
    if (!u) { const e = new Error('Usuario no encontrado'); e.status = 404; throw e; }
    const flags = await cargarContexto(ip);

    // Si LEGAJO=1, usar el documento de la persona; si no, clave por defecto.
    let nuevaClave = CLAVE_DEFECTO;
    if (flags.legajo) {
      const doc = await OperacionesModel.documentoPersonaPorUsuario(iduser);
      if (doc) nuevaClave = String(doc);
    }

    const d = [];
    await OperacionesModel.actualizarPass(iduser, nuevaClave);
    d.push(`[system] UPDATE USUARIO.pass (${flags.legajo ? 'clave=documento de legajo' : 'clave por defecto'})`);

    if (flags.gastronomia) {
      await OperacionesModel.actualizarMeseroClave(iduser, nuevaClave);
      d.push('[server] UPDATE GG_MESERO.clave');
    }

    replicarMaster(iduser, { ip, claveNueva: nuevaClave });
    await audit({ iduser, idoperacion: OP.RESET_CLAVE, rptUser, observacion: buildDetalle(d) });
    return { ok: true, mensaje: 'EXITOSO' };
  },

  // ===========================================================================
  // OP 4 \u2014 ELIMINAR HUELLA
  // ===========================================================================
  async eliminarHuella(ctx) {
    const { iduser, rptUser } = ctx;
    const u = await OperacionesModel.estadoUsuario(iduser);
    if (!u) { const e = new Error('Usuario no encontrado'); e.status = 404; throw e; }
    if (!u.documento) return { ok: true, mensaje: 'EXITOSO', detalle: 'Sin documento, nada que hacer' };

    const r = await OperacionesModel.eliminarHuella(u.documento);
    const d = r.borradas
      ? [`[server] DELETE RH_CARGO_BIO (${r.borradas} cargo/s: ${r.cargos.join(', ')})`]
      : ['Sin huellas registradas para el documento'];
    await audit({ iduser, idoperacion: OP.ELIMINAR_HUELLA, rptUser, observacion: buildDetalle(d) });
    return { ok: true, mensaje: 'EXITOSO', borradas: r.borradas };
  },

  // ===========================================================================
  // OP 5 \u2014 REASIGNACI\u00d3N DE SUCURSAL
  // ===========================================================================
  async reasignarSucursal(ctx) {
    const { iduser, idsucursal, rptUser, ip } = ctx;
    if (!idsucursal) { const e = new Error('idsucursal requerido'); e.status = 400; throw e; }
    if (!await OperacionesModel.existeUsuario(iduser)) {
      const e = new Error('Usuario no encontrado'); e.status = 404; throw e;
    }
    if (!await OperacionesModel.sucursalActiva(idsucursal)) {
      const e = new Error('Sucursal inv\u00e1lida o inactiva'); e.status = 400; throw e;
    }
    const flags = await cargarContexto(ip);

    const r = await OperacionesModel.reasignarSucursalCompleto(iduser, idsucursal);
    const d = [
      `[server] DELETE+INSERT USUARIO_SUCURSAL → suc=${idsucursal} (${r.sucursales} filas)`,
      `[server] DELETE+INSERT USUARIO_DEPOSITO salida dep=${r.idDepPrincipal ?? '-'} (${r.depositosSalida} filas)`,
      `[server] DELETE+INSERT USUARIO_DEPOSITO1 entrada (${r.depositosEntrada} filas)`,
    ];

    if (flags.gastronomia) {
      await OperacionesModel.actualizarMeseroSucursal(iduser, idsucursal);
      d.push(`[server] UPDATE GG_MESERO.idsucursal=${idsucursal}`);
    }
    await audit({ iduser, idoperacion: OP.REASIGNAR_SUCURSAL, rptUser, observacion: buildDetalle(d) });
    return { ok: true, mensaje: 'EXITOSO' };
  },

  // ===========================================================================
  // OP 6 \u2014 CAMBIO DE PERFIL
  // ===========================================================================
  async cambiarPerfil(ctx) {
    const { iduser, idperfil, rptUser, ip } = ctx;
    const u = await OperacionesModel.estadoUsuario(iduser);
    if (!u) { const e = new Error('Usuario no encontrado'); e.status = 404; throw e; }
    if (Number(u.idtipo_usuario) === Number(idperfil)) {
      return { ok: true, mensaje: 'EXITOSO', detalle: 'Sin cambios' };
    }
    const perfil = await OperacionesModel.perfilExisteActivo(idperfil);
    if (!perfil || Number(perfil.estado) !== 1) {
      const e = new Error('Perfil inv\u00e1lido o inactivo'); e.status = 400; throw e;
    }
    const flags = await cargarContexto(ip);

    const d = [];
    await OperacionesModel.cambiarPerfilUsuario(iduser, idperfil);
    d.push(`[system] UPDATE USUARIO.idtipo_usuario ${u.idtipo_usuario} → ${idperfil}`);

    if (flags.gastronomia) {
      const n = await OperacionesModel.actualizarMeseroPerfil(iduser, idperfil);
      if (n) d.push(`[server] UPDATE GG_MESERO.idtipo_mesero (perfil=${idperfil})`);
    }

    replicarMaster(iduser, { ip });
    await audit({ iduser, idoperacion: OP.CAMBIO_PERFIL, rptUser, observacion: buildDetalle(d) });
    return { ok: true, mensaje: 'EXITOSO' };
  },

  // ===========================================================================
  // OP 7 \u2014 ACTUALIZAR CUENTA (nombre/apellido/documento)
  // ===========================================================================
  async actualizarCuenta(ctx) {
    const { iduser, nombre, apellido, documento, rptUser, ip } = ctx;
    if (!await OperacionesModel.existeUsuario(iduser)) {
      const e = new Error('Usuario no encontrado'); e.status = 404; throw e;
    }
    const cambios = {};
    if (nombre != null) cambios.nombre = nombre;
    if (apellido != null) cambios.apellido = apellido;
    if (documento != null) cambios.documento = documento;
    if (!Object.keys(cambios).length) return { ok: true, mensaje: 'EXITOSO', detalle: 'Nada que actualizar' };

    await OperacionesModel.actualizarBasicos(iduser, cambios);
    const d = [`[system] UPDATE USUARIO (${Object.keys(cambios).join(', ')})`];
    replicarMaster(iduser, { ip });
    await audit({ iduser, idoperacion: OP.ACTUALIZAR_CUENTA, rptUser, observacion: buildDetalle(d) });
    return { ok: true, mensaje: 'EXITOSO' };
  },

  // ===========================================================================
  // OP 8 \u2014 VINCULAR LEGAJO
  // ===========================================================================
  async vincularLegajo(ctx) {
    const { iduser, documento, rptUser, ip } = ctx;
    if (!documento) { const e = new Error('documento requerido'); e.status = 400; throw e; }
    if (!await OperacionesModel.existeUsuario(iduser)) {
      const e = new Error('Usuario no encontrado'); e.status = 404; throw e;
    }
    const flags = await cargarContexto(ip);

    const d = [];
    await OperacionesModel.actualizarDocumento(iduser, documento);
    d.push(`[system] UPDATE USUARIO.documento=${documento}`);

    if (flags.legajo) {
      const cargo = await OperacionesModel.cargoActivoPorDocumento(documento);
      if (cargo?.idcargo && !cargo.user_system) {
        await OperacionesModel.asignarUserSystemAlCargo(cargo.idcargo, iduser);
        d.push(`[server] UPDATE RH_CARGO.user_system=${iduser} (cargo=${cargo.idcargo})`);
      }
      if (flags.gastronomia && cargo?.idpersona) {
        const n = await OperacionesModel.vincularMeseroPersona(iduser, cargo.idpersona, cargo.idcargo);
        if (n) d.push(`[server] UPDATE GG_MESERO.rh_idpersona/idcargo (persona=${cargo.idpersona})`);
      }
    }
    await audit({ iduser, idoperacion: OP.VINCULAR_LEGAJO, rptUser, observacion: buildDetalle(d) });
    return { ok: true, mensaje: 'EXITOSO' };
  },

  // ===========================================================================
  // OP 9 \u2014 EXCLUIR CUENTA
  // ===========================================================================
  async excluirCuenta(ctx) {
    const { iduser, rptUser } = ctx;
    if (!await OperacionesModel.existeUsuario(iduser)) {
      const e = new Error('Usuario no encontrado'); e.status = 404; throw e;
    }
    await OperacionesModel.excluirCuenta(iduser, 1);
    await audit({ iduser, idoperacion: OP.EXCLUIR_CUENTA, rptUser,
      observacion: buildDetalle(['[system] UPDATE USUARIO.exclusion=1']) });
    return { ok: true, mensaje: 'EXITOSO' };
  },

  // ===========================================================================
  // OP 10 \u2014 MIGRACI\u00d3N DE DATOS (stub)
  // ===========================================================================
  async migrarDatos(ctx) {
    const { iduser, rptUser } = ctx;
    await audit({ iduser, idoperacion: OP.MIGRAR_DATOS, rptUser,
      observacion: buildDetalle(['[pendiente] Replicaci\u00f3n a destinos externos no implementada v\u00eda Node']) });
    return { ok: false, mensaje: 'MIGRACION_PENDIENTE',
      detalle: 'La migraci\u00f3n a destinos externos a\u00fan no fue portada desde el SP legacy' };
  },

  // ===========================================================================
  // OP 11 \u2014 REACTIVAR
  // ===========================================================================
  async reactivar(ctx) {
    const { iduser, rptUser, ip } = ctx;
    const u = await OperacionesModel.estadoUsuario(iduser);
    if (!u) { const e = new Error('Usuario no encontrado'); e.status = 404; throw e; }
    if (Number(u.estado) === 1) return { ok: true, mensaje: 'EXITOSO', detalle: 'Ya estaba activo' };

    await OperacionesModel.cambiarEstadoUsuario(iduser, 1);
    replicarMaster(iduser, { ip });
    await audit({ iduser, idoperacion: OP.REACTIVAR, rptUser,
      observacion: buildDetalle(['[system] UPDATE USUARIO.estado=1']) });
    return { ok: true, mensaje: 'EXITOSO' };
  },
};

module.exports = OperacionesService;
