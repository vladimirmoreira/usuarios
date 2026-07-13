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
const AccesosService = require('./accesos.service');
const MasterSyncService = require('./masterSync.service');
const MasterModel = require('../models/master.model');
const { auditarDirecto } = require('../utils/audit');
const { query, transaction } = require('../config/firebird');
const { OP, OP_BY_ID } = require('../config/operaciones.config');
const env = require('../config/env');
const logger = require('../utils/logger');

const CLAVE_DEFECTO = '12345678901234567890';

// Códigos de verificación para reset de clave (en memoria, expiran en 10 min).
// Simulado: sin gateway de email/SMS real, el código se devuelve para mostrarlo al operador.
const _resetCodes = new Map(); // iduserUpper -> { code, expires }
const RESET_TTL_MS = 10 * 60 * 1000;

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

/** \u00bfEl rol del usuario replica a MASTER? (tipo_usuario.master=1; ADMIN siempre). */
async function rolEsMaster(iduser) {
  if (!iduser) return false;
  if (iduser.trim().toUpperCase() === 'ADMIN') return true;
  const r = await query(
    'system',
    `SELECT FIRST 1 COALESCE(t.master,0) AS master FROM usuario u
       LEFT JOIN tipo_usuario t ON t.idtipo_usuario = u.idtipo_usuario
      WHERE UPPER(TRIM(u.iduser)) = UPPER(TRIM(?))`,
    [iduser],
  );
  return Number(r[0]?.master) === 1;
}

/** Empresa MASTER mapeada a una empresa SYSTEM (EMPRESA.idempresa_system), o null. */
async function masterEmpMapeada(sysIdempresa) {
  const s = String(sysIdempresa ?? '').trim();
  if (!s) return null;
  try {
    const r = await query(
      'master',
      `SELECT FIRST 1 CAST(TRIM(idempresa) AS VARCHAR(2) CHARACTER SET OCTETS) AS idempresa
         FROM empresa
        WHERE estado = 1 AND COALESCE(TRIM(idempresa_system),'0') <> '0'
          AND CAST(TRIM(idempresa_system) AS VARCHAR(2) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(2) CHARACTER SET OCTETS)`,
      [s],
    );
    return r[0]?.idempresa ? String(r[0].idempresa).trim() : null;
  } catch (_) { return null; }
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

    // Alta completa (USUARIO + USUARIOEMPRESA + MENU + sucursal/dep\u00f3sitos/conceptos).
    // Este es el n\u00facleo transaccional: si falla, no se crea nada (500 real).
    await OperacionesModel.altaCompleta({
      iduser, idperfil, nombre, apellido, documento, idsucursal,
      templateIduser: tpl.iduser,
    });

    // Post-efectos best-effort: el usuario YA est\u00e1 creado y confirmado, as\u00ed que un
    // fallo aqu\u00ed (auditor\u00eda, legajo, mesero) NO debe tumbar el alta con un 500.
    // Se registran como advertencias y se loguean (comportamiento espejo de altasBatch).
    const advertencias = [];
    const safe = async (label, fn) => {
      try { await fn(); } catch (e) {
        logger.warn({ err: e?.message, iduser, label }, 'altaUsuario post-efecto fall\u00f3');
        advertencias.push(`${label}: ${e?.message || 'error'}`);
      }
    };

    await safe('auditor\u00eda', () => audit({ iduser, idoperacion: OP.ALTA, rptUser,
      observacion: `Perfil=${idperfil} Suc=${idsucursal} Doc=${documento}` }));

    // RH \u2014 vincular legajo si LEGAJO=1 y existe persona/cargo
    if (flags.legajo) {
      await safe('legajo', async () => {
        const cargo = await OperacionesModel.cargoActivoPorDocumento(documento);
        if (cargo?.idcargo && !cargo.user_system) {
          await OperacionesModel.asignarUserSystemAlCargo(cargo.idcargo, iduser);
          await audit({ iduser, idoperacion: OP.ALTA, rptUser,
            observacion: `Legajo vinculado al cargo ${cargo.idcargo}` });
        }
      });
    }

    // PDV \u2014 dar de alta como mesero si GASTRONOMIA=1 y perfil tipo=1
    if (flags.gastronomia && Number(tpl.tipo) === 1) {
      await safe('gg_mesero', async () => {
        const cargo = flags.legajo ? await OperacionesModel.cargoActivoPorDocumento(documento) : null;
        const idtipoMesero = await OperacionesModel.tipoMeseroDeTemplate(tpl.iduser);
        await OperacionesModel.insertarMesero({
          nombre, apellido, documento, idperfil,
          idpersona: cargo?.idpersona ?? null,
          idsucursal, iduser,
          idcargo: cargo?.idcargo ?? null,
          idtipoMesero,
        });
        await audit({ iduser, idoperacion: OP.ALTA, rptUser,
          observacion: 'Alta GG_MESERO (gastronom\u00eda)' });
      });
    }

    // MASTER \u2014 replicar si rol.master = 1 (ya es best-effort)
    replicarMaster(iduser, { ip });

    return { ok: true, mensaje: 'EXITOSO', ...(advertencias.length ? { advertencias } : {}) };
  },

  // ===========================================================================
  // ALTA SIN ROL — usuario sin plantilla (idtipo_usuario = 0)
  // ===========================================================================
  async altaSinRol(ctx) {
    const { iduser, nombre, apellido, documento, rptUser, ip } = ctx;
    if (await OperacionesModel.existeUsuario(iduser)) {
      const e = new Error('El usuario ya existe'); e.status = 400; throw e;
    }
    await OperacionesModel.altaSinRol({ iduser, nombre, apellido, documento });
    await audit({ iduser, idoperacion: OP.ALTA, rptUser,
      observacion: `Alta sin rol · Doc=${documento}` });
    // Replicación a master no aplica (idtipo_usuario=0 no tiene rol master),
    // pero el editor muestra Contab./RRHH sin activar si el pool está habilitado.
    void ip;
    return { ok: true, mensaje: 'EXITOSO' };
  },

  // ===========================================================================
  // CLONAR ACCESOS A OTRA EMPRESA
  // ===========================================================================
  /**
   * Clona los accesos per-empresa de SYSTEM (USUARIOEMPRESA + MENU_GENERAL) de la
   * empresa `origen` a la empresa `destino` para un usuario. NO toca las tablas por
   * usuario (usuario_concepto / sucursal / depósitos = globales). Si el rol es master
   * y la empresa destino tiene mapeo `EMPRESA.idempresa_system`, también clona los
   * accesos master. Reglas: destino ≠ 1 (base), destino accesible=1, y si el usuario
   * ya tiene accesos en destino no se hace nada.
   */
  async clonarAEmpresa({ iduser, origen, destino, rptUser, ip }) {
    const src = String(origen ?? '').trim();
    const dst = String(destino ?? '').trim();
    if (!dst)        { const e = new Error('Empresa destino requerida'); e.status = 400; throw e; }
    if (dst === '1') { const e = new Error('La empresa 1 (base) no puede ser destino'); e.status = 400; throw e; }
    if (!src)        { const e = new Error('Empresa origen requerida'); e.status = 400; throw e; }
    if (dst === src) { const e = new Error('Origen y destino no pueden ser iguales'); e.status = 400; throw e; }
    if (!await OperacionesModel.existeUsuario(iduser)) {
      const e = new Error('Usuario no encontrado'); e.status = 404; throw e;
    }

    // Destino: debe existir y estar accesible=1
    const empRows = await query(
      'system',
      `SELECT FIRST 1 COALESCE(accesible,1) AS acc
         FROM empresas
        WHERE CAST(TRIM(idempresa) AS VARCHAR(2) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(2) CHARACTER SET OCTETS)`,
      [dst],
    );
    if (!empRows.length) { const e = new Error('Empresa destino inexistente'); e.status = 400; throw e; }
    if (Number(empRows[0].acc) !== 1) {
      const e = new Error('La empresa destino no está marcada como accesible'); e.status = 400; throw e;
    }

    const tieneUE = async (emp) => (await query(
      'system',
      `SELECT FIRST 1 iduser FROM usuarioempresa
        WHERE UPPER(TRIM(iduser)) = UPPER(TRIM(?))
          AND CAST(TRIM(idempresa) AS VARCHAR(2) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(2) CHARACTER SET OCTETS)`,
      [iduser, emp],
    )).length > 0;

    if (!await tieneUE(src)) {
      const e = new Error(`El usuario no tiene accesos en la empresa origen (${src})`); e.status = 400; throw e;
    }
    // Punto 3: si ya tiene accesos en destino, no hacer nada.
    if (await tieneUE(dst)) {
      return { ok: true, mensaje: 'EXITOSO', clonado: false,
        detalle: `El usuario ya tenía accesos en la empresa ${dst}; no se modificó nada.` };
    }

    const d = [];
    // ── Clon SYSTEM: USUARIOEMPRESA + MENU_GENERAL (origen → destino) ──
    await transaction('system', async (tx) => {
      await tx.query(
        `INSERT INTO usuarioempresa
           (iduser, idempresa, permisos, menu, anovigente, perfil, movimientos,
            modo_print, descuento, talonario, menu_gg_2, permiso_gg, menu_gg_1, menu_gg)
         SELECT iduser, ?, permisos, menu, anovigente, perfil, movimientos,
                modo_print, descuento, talonario, menu_gg_2, permiso_gg, menu_gg_1, menu_gg
           FROM usuarioempresa
          WHERE UPPER(TRIM(iduser)) = UPPER(TRIM(?))
            AND CAST(TRIM(idempresa) AS VARCHAR(2) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(2) CHARACTER SET OCTETS)`,
        [dst, iduser, src],
      );
      await tx.query(
        `INSERT INTO menu_general (idmenu_principal, idempresa, iduser, idmenu, titulo, permiso)
         SELECT gen_id(gen_menu_general, 1), ?, iduser, idmenu, titulo, permiso
           FROM menu_general
          WHERE UPPER(TRIM(iduser)) = UPPER(TRIM(?))
            AND CAST(TRIM(idempresa) AS VARCHAR(2) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(2) CHARACTER SET OCTETS)`,
        [dst, iduser, src],
      );
    });
    d.push(`[system] USUARIOEMPRESA + MENU_GENERAL clonados: empresa ${src} → ${dst}`);

    // ── Clon MASTER (best-effort): solo si rol master y destino tiene mapeo ──
    try {
      if (MasterModel.habilitado() && await rolEsMaster(iduser)) {
        const masterDst = await masterEmpMapeada(dst);
        if (!masterDst) {
          d.push(`[master] destino ${dst} sin mapeo idempresa_system → no se clonó`);
        } else {
          const masterSrc = (await masterEmpMapeada(src)) || String(env.MASTER_IDEMPRESA || '1');
          await MasterSyncService.syncUsuario(iduser, { ip, idempresa: src });
          const mSrc = await MasterModel.obtenerUsuarioEmpresa(iduser, masterSrc);
          const mDst = await MasterModel.obtenerUsuarioEmpresa(iduser, masterDst);
          if (mSrc && !mDst) {
            await MasterModel.upsertUsuarioEmpresa({
              iduser, idempresa: masterDst,
              permisos: mSrc.permisos, menu: mSrc.menu, modulos: mSrc.modulos || '100', estado: 1,
            });
            d.push(`[master] accesos clonados: empresa ${masterSrc} → ${masterDst}`);
          } else {
            d.push(`[master] ${mDst ? 'ya existía en ' + masterDst + ', sin cambios' : 'sin accesos origen para clonar'}`);
          }
        }
      }
    } catch (e) {
      logger.warn({ err: e.message, iduser, dst }, 'clonarAEmpresa master falló (best-effort)');
      d.push(`[master] error: ${e.message}`);
    }

    // Log (punto 6)
    await audit({ iduser, idoperacion: OP.ACTUALIZAR_CUENTA, rptUser,
      observacion: buildDetalle([`Clonación de accesos a empresa ${dst} (origen ${src})`, ...d]) });

    return { ok: true, mensaje: 'EXITOSO', clonado: true, empresa: dst, detalle: d };
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

    // ── Transacción atómica en dos bases (system + server) ──────────────────
    // Las tablas de sucursal/depósitos/conceptos viven en `server`; el resto en
    // `system`. La tx de `server` va anidada dentro de la de `system`: si algún
    // INSERT falla (en cualquiera de las dos bases), ambas revierten en cascada,
    // manteniendo el "todo o nada" del lote.
    const wrapFila = (p, e) => {
      const wrapped = new Error(`Fila ${p.fila} (${p.iduser}): ${e.message}`);
      wrapped.fila   = p.fila;
      wrapped.iduser = p.iduser;
      return wrapped;
    };
    await transaction('system', async (sysTx) => {
      // 1) Parte system de todos los usuarios
      for (const p of batch) {
        const tpl = tplMap.get(p.fila);
        try {
          await OperacionesModel.altaSystemPart(sysTx, {
            iduser: p.iduser, idperfil: p.idperfil,
            nombre: p.nombre, apellido: p.apellido,
            documento: p.documento, templateIduser: tpl.iduser,
          });
        } catch (e) { throw wrapFila(p, e); }
      }
      // 2) Parte server de todos los usuarios (revierte system si falla)
      await transaction('server', async (srvTx) => {
        for (const p of batch) {
          const tpl = tplMap.get(p.fila);
          try {
            await OperacionesModel.altaServerPart(srvTx, {
              iduser: p.iduser, idsucursal: p.idsucursal, templateIduser: tpl.iduser,
            });
          } catch (e) { throw wrapFila(p, e); }
        }
      });
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
          const idtipoMesero = await OperacionesModel.tipoMeseroDeTemplate(tpl.iduser);
          await OperacionesModel.insertarMesero({
            nombre: p.nombre, apellido: p.apellido, documento: p.documento,
            idperfil: p.idperfil, idpersona: cargo?.idpersona ?? null,
            idsucursal: p.idsucursal, iduser: p.iduser, idcargo: cargo?.idcargo ?? null,
            idtipoMesero,
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
  // Reset directo (sin código) — usado por la acción masiva (bulk).
  async resetClave(ctx) {
    return this._aplicarReset(ctx, null);
  },

  // Aplica el reset. `claveForzada` (opcional) sobreescribe la lógica default/legajo.
  async _aplicarReset(ctx, claveForzada) {
    const { iduser, rptUser, ip } = ctx;
    const u = await OperacionesModel.estadoUsuario(iduser);
    if (!u) { const e = new Error('Usuario no encontrado'); e.status = 404; throw e; }
    const flags = await cargarContexto(ip);

    // Si se pasó clave manual usarla; si no: LEGAJO=1 → documento; si no → clave por defecto.
    let nuevaClave = claveForzada || CLAVE_DEFECTO;
    let origen = claveForzada ? 'clave manual' : 'clave por defecto';
    if (!claveForzada && flags.legajo) {
      const doc = await OperacionesModel.documentoPersonaPorUsuario(iduser);
      if (doc) { nuevaClave = String(doc); origen = 'clave=documento de legajo'; }
    }

    const d = [];
    await OperacionesModel.actualizarPass(iduser, nuevaClave);
    d.push(`[system] UPDATE USUARIO.pass (${origen})`);

    if (flags.gastronomia) {
      await OperacionesModel.actualizarMeseroClave(iduser, nuevaClave);
      d.push('[server] UPDATE GG_MESERO.clave');
    }

    replicarMaster(iduser, { ip, claveNueva: nuevaClave });
    await audit({ iduser, idoperacion: OP.RESET_CLAVE, rptUser, observacion: buildDetalle(d) });
    return { ok: true, mensaje: 'EXITOSO' };
  },

  // Paso 1: genera y "envía" un código de verificación (simulado → se devuelve al operador).
  async resetClaveIniciar(ctx) {
    const { iduser, ip } = ctx;
    const u = await OperacionesModel.estadoUsuario(iduser);
    if (!u) { const e = new Error('Usuario no encontrado'); e.status = 404; throw e; }
    const flags = await cargarContexto(ip).catch(() => ({}));
    const code = String(Math.floor(100000 + Math.random() * 900000));
    _resetCodes.set(String(iduser).trim().toUpperCase(), { code, expires: Date.now() + RESET_TTL_MS });
    // Sin SMTP/gateway real → simulado: el operador comunica el código al usuario.
    return { ok: true, simulado: true, mail_habilitado: Number(flags?.mail_resetclave) === 1, codigo: code, expira_min: 10 };
  },

  // Paso 2: verifica el código y aplica el reset (clave manual opcional).
  async resetClaveConfirmar(ctx) {
    const { iduser, codigo, nuevaClave, rptUser, ip } = ctx;
    const idu = String(iduser).trim().toUpperCase();
    const rec = _resetCodes.get(idu);
    if (!rec || rec.expires < Date.now()) { const e = new Error('Código inexistente o vencido. Solicitá uno nuevo.'); e.status = 400; throw e; }
    if (String(codigo).trim() !== rec.code) { const e = new Error('Código incorrecto.'); e.status = 400; throw e; }
    _resetCodes.delete(idu);
    const clave = nuevaClave && String(nuevaClave).trim() ? String(nuevaClave).trim() : null;
    return this._aplicarReset({ iduser, rptUser, ip }, clave);
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
    // idperfil = 0 => "Sin Rol": no requiere plantilla; solo re-etiqueta idtipo_usuario.
    // \u00datil para sacar a un usuario "Sin Asignaci\u00f3n" (-1) de ese limbo asign\u00e1ndole Sin Rol.
    if (Number(idperfil) !== 0) {
      const perfil = await OperacionesModel.perfilExisteActivo(idperfil);
      if (!perfil || Number(perfil.estado) !== 1) {
        const e = new Error('Perfil inv\u00e1lido o inactivo'); e.status = 400; throw e;
      }
    }
    const flags = await cargarContexto(ip);

    const d = [];
    await OperacionesModel.cambiarPerfilUsuario(iduser, idperfil);
    d.push(`[system] UPDATE USUARIO.idtipo_usuario ${u.idtipo_usuario} → ${idperfil}`);

    // "Reemplazar todo": al asignar un rol real, copiar sus accesos (menú, permisos
    // generales/movimientos/pdv/gg y conceptos) desde la plantilla del rol al usuario.
    // No aplica a "Sin Rol" (0) ni "Sin Asignación" (-1), que no tienen plantilla.
    let notaPersonalizado = null;
    if (Number(idperfil) > 0) {
      try {
        const res = await AccesosService.aplicarRolAUsuario(iduser, idperfil);
        if (res.aplicado) {
          d.push('[system/server] Accesos copiados desde la plantilla del rol (menú, permisos, conceptos, sucursales, depósitos)');
        } else if (res.motivo === 'personalizado') {
          notaPersonalizado = 'Usuario Personalizado: se cambió el perfil pero NO se copiaron los accesos del rol. Para reemplazarlos, incluílo desde «Propagar».';
          d.push('[info] Usuario Personalizado (exclusion_permisos=1): no se copiaron los accesos del rol');
        }
      } catch (e) {
        logger.warn({ err: e?.message, iduser, idperfil }, 'cambiarPerfil: no se pudieron copiar los accesos del rol');
        d.push('[warn] No se pudieron copiar todos los accesos del rol; usar «Propagar» desde el rol');
      }
    }

    if (flags.gastronomia) {
      const n = await OperacionesModel.actualizarMeseroPerfil(iduser, idperfil);
      if (n) d.push(`[server] UPDATE GG_MESERO.idtipo_mesero (perfil=${idperfil})`);
    }

    replicarMaster(iduser, { ip });
    await audit({ iduser, idoperacion: OP.CAMBIO_PERFIL, rptUser, observacion: buildDetalle(d) });
    return { ok: true, mensaje: 'EXITOSO', ...(notaPersonalizado ? { detalle: notaPersonalizado } : {}) };
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
