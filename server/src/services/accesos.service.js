'use strict';

const MenuModel = require('../models/menu.model');
const PermisoModel = require('../models/permiso.model');
const CatalogoModel = require('../models/catalogo.model');
const ConceptoModel = require('../models/concepto.model');
const UsuarioSucursalModel = require('../models/usuarioSucursal.model');
const UsuarioDepositoModel = require('../models/usuarioDeposito.model');
const { decodeSN, encodeSN, decode01, encode01, decodeConcepto, encodeConcepto } = require('./permisos.service');
const { query: fbQuery, transaction: fbTx } = require('../config/firebird');
const env = require('../config/env');

const SIZE_PERMISOS = 50;       // USUARIOEMPRESA.PERMISOS VARCHAR(50)
const SIZE_MOVIMIENTOS = 20;    // USUARIOEMPRESA.MOVIMIENTOS VARCHAR(20)
const SIZE_PERMISO_GG = 50;     // USUARIOEMPRESA.PERMISO_GG VARCHAR(50)
const SIZE_MENU_GG_2 = 100;     // USUARIOEMPRESA.MENU_GG_2 VARCHAR(100)

const emp = (v) => v || env.DEFAULT_IDEMPRESA;

const AccesosService = {
  async obtenerCompleto(iduser, idempresa) {
    const empresa = emp(idempresa);
    let [ue, menu, catPg, catPdv] = await Promise.all([
      PermisoModel.obtenerUsuarioEmpresa(iduser, empresa),
      MenuModel.listarPorUsuario(iduser, empresa),
      CatalogoModel.permisosGenerales(),
      CatalogoModel.permisosPdv(),
    ]);

    // edicion_rol: consulta separada para que un error (ej: columna aún no migrada)
    // no rompa toda la carga de permisos.
    let edicion_rol = false;
    try {
      const rolInfo = await require('../config/firebird').query(
        'system',
        `SELECT COALESCE(tu.edicion_rol, 0) AS edicion_rol
           FROM usuario u
           LEFT JOIN tipo_usuario tu ON tu.idtipo_usuario = u.idtipo_usuario
          WHERE UPPER(TRIM(u.iduser)) = UPPER(TRIM(?))`,
        [iduser],
      );
      edicion_rol = rolInfo[0]?.edicion_rol === 1;
    } catch (_) {
      // La columna no existe todavía (migración pendiente); se ignora el error.
    }

    // Si el usuario/rol no tiene configuración de menú, inicializar copiando de Admin (permiso=0)
    if (menu.length === 0) {
      try {
        menu = await MenuModel.copiarDesdeAdmin(iduser, empresa);
      } catch (e) {
        if (e.gdscode === 335544466 /* FK violation */) {
          // El usuario plantilla no existe en 'usuario' (rol creado antes de la lógica actual).
          // Lo creamos ahora para que las FK queden satisfechas.
          await require('../config/firebird').query(
            'system',
            `INSERT INTO usuario (iduser, nombre, apellido, idtipo_usuario, estado)
             SELECT FIRST 1 ?, descripcion, 'PLANTILLA', -1, 1
               FROM tipo_usuario WHERE UPPER(TRIM(iduser)) = UPPER(TRIM(?))`,
            [iduser, iduser],
          );
          menu = await MenuModel.copiarDesdeAdmin(iduser, empresa);
        } else {
          menu = [];
        }
      }
    }

    // Si tampoco tiene fila en usuarioempresa, crearla con valores por defecto (todo vacío/false)
    if (!ue) {
      try {
        await PermisoModel.inicializar(iduser, empresa);
      } catch (_) {
        // Si aún así falla (ej: error inesperado), usamos defaults en memoria sin persistir.
      }
      ue = { iduser, idempresa: empresa, permisos: '', movimientos: '', permiso_gg: '', menu_gg_2: '' };
    }

    return {
      iduser,
      idempresa: ue?.idempresa || null,
      edicion_rol,
      menu,
      permisosGenerales: {
        catalogo: catPg,
        flags: decodeSN(ue?.permisos, SIZE_PERMISOS),
      },
      movimientos: {
        flags: decodeSN(ue?.movimientos, SIZE_MOVIMIENTOS),
      },
      pdv: {
        catalogo: catPdv,
        flags: decode01(ue?.menu_gg_2, SIZE_MENU_GG_2),
      },
      permisoGg: {
        flags: decodeSN(ue?.permiso_gg, SIZE_PERMISO_GG),
      },
    };
  },

  actualizarPermisosGenerales: (iduser, flags, idempresa) =>
    PermisoModel.actualizarCampo(iduser, emp(idempresa), 'permisos', encodeSN(flags, SIZE_PERMISOS)),

  actualizarMovimientos: (iduser, flags, idempresa) =>
    PermisoModel.actualizarCampo(iduser, emp(idempresa), 'movimientos', encodeSN(flags, SIZE_MOVIMIENTOS)),

  actualizarPdv: (iduser, flags, idempresa) =>
    PermisoModel.actualizarCampo(iduser, emp(idempresa), 'menu_gg_2', encode01(flags, SIZE_MENU_GG_2)),

  actualizarPermisoGg: (iduser, flags, idempresa) =>
    PermisoModel.actualizarCampo(iduser, emp(idempresa), 'permiso_gg', encodeSN(flags, SIZE_PERMISO_GG)),

  actualizarMenu: (iduser, items) => MenuModel.actualizarPermisos(iduser, items),

  /**
   * Devuelve los conceptos de tipomovimiento agrupados por tipo (0=Inventario, 1=Compra, 2=Venta)
   * junto con los permisos actuales del usuario (permiso_varios decodificado).
   */
  async obtenerConceptos(iduser) {
    const TIPOS_LABELS = {
      0:  'Inventario',
      1:  'Compra',
      2:  'Venta',
      3:  'Ajustes',
      4:  'Nota de Crédito Cliente',
      5:  'Nota de Débito Cliente',
      6:  'Transferencias',
      7:  'Pedido de Venta',
      8:  'Pedido de Compra',
      9:  'Presupuesto de Venta',
      10: 'Presupuesto de Compra',
      11: 'Importación',
      12: 'Nota de Crédito Proveedor',
      13: 'Nota de Débito Proveedor',
      14: 'Devolución',
      15: 'Remisión Cliente',
      16: 'Remisión Proveedor',
    };

    const [tiposMovimiento, userConceptos, permisosCatalogo] = await Promise.all([
      ConceptoModel.listarTiposMovimiento(),
      ConceptoModel.listarPorUsuario(iduser),
      CatalogoModel.permisosConceptos(),
    ]);

    const userMap = new Map(
      userConceptos.map((c) => [Number(c.idtipomovimiento), c]),
    );

    const gruposMap = {};
    for (const tm of tiposMovimiento) {
      const tipo = Number(tm.tipo);
      if (!gruposMap[tipo]) {
        gruposMap[tipo] = {
          tipo,
          label: TIPOS_LABELS[tipo] ?? `Tipo ${tipo}`,
          conceptos: [],
        };
      }
      const uc = userMap.get(Number(tm.idtipomovimiento));
      gruposMap[tipo].conceptos.push({
        idtipomovimiento: Number(tm.idtipomovimiento),
        descripcion: tm.descripcion,
        permiso: uc ? (Number(uc.permiso) || 0) : 0,
        permisoVarios: decodeConcepto(uc?.permiso_varios),
        idtalonario:  uc?.idtalonario  ?? null,
        idvendedor:   uc?.idvendedor   ?? null,
        idpersona:    uc?.idpersona    ?? null,
        idplanventa:  uc?.idplanventa  ?? null,
        idcondicion:  uc?.idcondicion  ?? null,
      });
    }

    return {
      permisosCatalogo,
      grupos: Object.values(gruposMap).sort((a, b) => a.tipo - b.tipo),
    };
  },

  /**
   * Guarda los conceptos del usuario en USUARIO_CONCEPTO (upsert masivo).
   * Los 5 campos extra (idtalonario, idvendedor, idpersona, idplanventa, idcondicion)
   * son opcionales: si no vienen en el item se preservan los valores existentes.
   * @param {string} iduser
   * @param {Array<{idtipomovimiento:number, permiso:number, permisoVarios:boolean[],
   *               idtalonario?:number|null, idvendedor?:number|null,
   *               idpersona?:number|null, idplanventa?:number|null,
   *               idcondicion?:number|null}>} items
   */
  actualizarConceptos(iduser, items) {
    const encoded = items.map((it) => {
      const out = {
        idtipomovimiento: it.idtipomovimiento,
        permiso: it.permiso ? 1 : 0,
        permisoVarios: encodeConcepto(it.permisoVarios),
      };
      for (const col of ['idtalonario', 'idvendedor', 'idpersona', 'idplanventa', 'idcondicion']) {
        if (it[col] !== undefined) out[col] = it[col];
      }
      return out;
    });
    return ConceptoModel.upsertBatch(iduser, encoded);
  },

  // ── Sucursales por usuario ──────────────────────────────────────────────
  async obtenerSucursales(iduser) {
    const [catalogo, asignadas] = await Promise.all([
      CatalogoModel.sucursales(),
      UsuarioSucursalModel.listarPorUsuario(iduser),
    ]);
    const mapAsig = new Map(asignadas.map((s) => [Number(s.idsucursal), Number(s.orden) || 0]));
    const items = catalogo.map((s) => ({
      idsucursal: Number(s.idsucursal),
      nombre: s.nombre,
      habilitada: mapAsig.has(Number(s.idsucursal)),
      orden: mapAsig.get(Number(s.idsucursal)) ?? 0,
    }));
    return { items };
  },

  /**
   * Reemplaza la asignación de sucursales del usuario.
   * @param {string} iduser
   * @param {Array<{idsucursal:number, habilitada:boolean, orden?:number}>} items
   */
  async actualizarSucursales(iduser, items) {
    const habilitadas = items
      .filter((s) => s.habilitada)
      .map((s) => ({ idsucursal: Number(s.idsucursal), orden: Number(s.orden) || 0 }));
    return UsuarioSucursalModel.replaceAll(iduser, habilitadas);
  },

  // ── Depósitos por usuario (salida / entrada) ────────────────────────────
  async obtenerDepositos(iduser) {
    const [catalogo, asignadas] = await Promise.all([
      CatalogoModel.depositos(),
      UsuarioDepositoModel.listarPorUsuario(iduser),
    ]);
    const mapSal = new Map(asignadas.salida.map((d) => [Number(d.iddeposito), Number(d.orden) || 0]));
    const mapEnt = new Map(asignadas.entrada.map((d) => [Number(d.iddeposito), Number(d.orden) || 0]));
    const items = catalogo.map((d) => ({
      iddeposito: Number(d.iddeposito),
      descripcion: d.descripcion,
      idsucursal: Number(d.idsucursal),
      salida:   mapSal.has(Number(d.iddeposito)),
      entrada:  mapEnt.has(Number(d.iddeposito)),
      ordenSalida:  mapSal.get(Number(d.iddeposito)) ?? 0,
      ordenEntrada: mapEnt.get(Number(d.iddeposito)) ?? 0,
    }));
    return { items };
  },

  /**
   * Reemplaza la asignación de depósitos del usuario.
   * Salida: solo se persisten los cuya sucursal esté habilitada (validado en model).
   * @param {string} iduser
   * @param {Array<{iddeposito:number, salida:boolean, entrada:boolean,
   *                 ordenSalida?:number, ordenEntrada?:number}>} items
   */
  async actualizarDepositos(iduser, items) {
    const salida = items
      .filter((d) => d.salida)
      .map((d) => ({ iddeposito: Number(d.iddeposito), orden: Number(d.ordenSalida) || 0 }));
    const entrada = items
      .filter((d) => d.entrada)
      .map((d) => ({ iddeposito: Number(d.iddeposito), orden: Number(d.ordenEntrada) || 0 }));
    return UsuarioDepositoModel.replaceAll(iduser, { salida, entrada });
  },

  /**
   * Propaga los permisos de la plantilla del rol a todos sus usuarios activos.
   * - Los usuarios NO excluidos reciben los permisos y quedan con exclusion_permisos = 0.
   * - Los usuarios excluidos mantienen sus permisos actuales y quedan con exclusion_permisos = 1.
   *
   * @param {string}   iduser_plantilla  iduser de la fila plantilla del rol
   * @param {number}   idperfil          idtipo_usuario del rol
   * @param {string[]} excluidos         lista de iduser que NO recibirán los permisos
   * @param {string}   idempresa
   * @returns {{ propagados: number, excluidos: number }}
   */
  async propagarDesdeRol(iduser_plantilla, idperfil, excluidos, idempresa) {
    const empresa = emp(idempresa);
    const excSet = new Set((excluidos || []).map((s) => s.toUpperCase().trim()));

    // 1. Listar usuarios activos del rol (excluye filas plantilla)
    const usuarios = await fbQuery(
      'system',
      `SELECT u.iduser, COALESCE(TRIM(u.documento), '') AS documento
         FROM usuario u
        WHERE u.idtipo_usuario = ?
          AND NOT EXISTS (SELECT 1 FROM tipo_usuario t WHERE t.iduser = u.iduser)
          AND UPPER(TRIM(u.iduser)) <> 'ADMIN'
          AND COALESCE(u.estado, 0) = 1`,
      [idperfil],
    );

    if (!usuarios.length) return { propagados: 0, excluidos: 0, errores: [], sin_documento: [] };

    // 2. Obtener datos de la plantilla
    const [plantillaUe, plantillaMenu, plantillaConceptos] = await Promise.all([
      PermisoModel.obtenerUsuarioEmpresa(iduser_plantilla, empresa),
      MenuModel.listarPorUsuario(iduser_plantilla, empresa),
      ConceptoModel.listarPorUsuario(iduser_plantilla).catch(() => []),
    ]);

    let propagados = 0;
    let excCount = 0;
    const errores       = [];   // { iduser, mensaje } — error inesperado
    const sin_documento = [];   // { iduser } — validación DB impide cambiar exclusion_permisos

    for (const u of usuarios) {
      const upper = u.iduser.toUpperCase().trim();

      if (excSet.has(upper)) {
        // Solo marcar como personalizado (excluido de esta propagación)
        // Si no tiene documento, el UPDATE usuario falla por constraint → saltar
        if (!u.documento) {
          sin_documento.push({ iduser: u.iduser });
          excCount++;  // igual contamos como excluido para el resumen
        } else {
          try {
            await fbQuery(
              'system',
              `UPDATE usuario SET exclusion_permisos = 1 WHERE UPPER(TRIM(iduser)) = UPPER(TRIM(?))`,
              [u.iduser],
            );
            excCount++;
          } catch (e) {
            errores.push({ iduser: u.iduser, mensaje: `No se pudo marcar como excluido: ${e?.message || 'error desconocido'}` });
          }
        }
      } else {
        // Propagar permisos y unificar con el rol
        // Si no tiene documento, el UPDATE usuario falla por constraint → propagar menus/permisos
        // pero omitir el UPDATE de exclusion_permisos (queda con el valor actual)
        const sinDoc = !u.documento;
        try {
          await fbTx('system', async (tx) => {
            // menu_general: reemplazar desde plantilla
            await tx.query(
              `DELETE FROM menu_general WHERE UPPER(iduser) = UPPER(?) AND idempresa = ?`,
              [u.iduser, empresa],
            );
            for (const m of plantillaMenu) {
              await tx.query(
                `INSERT INTO menu_general (idmenu_principal, idempresa, iduser, idmenu, titulo, permiso)
                 VALUES (gen_id(gen_menu_general, 1), ?, ?, ?, ?, ?)`,
                [empresa, u.iduser, m.idmenu, m.titulo, m.permiso],
              );
            }

            // usuarioempresa: upsert de flags
            const ueVals = [
              plantillaUe?.permisos    || '',
              plantillaUe?.movimientos || '',
              plantillaUe?.permiso_gg  || '',
              plantillaUe?.menu_gg_2   || '',
            ];
            const existe = await tx.query(
              `SELECT FIRST 1 iduser FROM usuarioempresa WHERE UPPER(iduser) = UPPER(?) AND idempresa = ?`,
              [u.iduser, empresa],
            );
            if (existe.length) {
              await tx.query(
                `UPDATE usuarioempresa SET permisos = ?, movimientos = ?, permiso_gg = ?, menu_gg_2 = ?
                  WHERE UPPER(iduser) = UPPER(?) AND idempresa = ?`,
                [...ueVals, u.iduser, empresa],
              );
            } else {
              await tx.query(
                `INSERT INTO usuarioempresa (iduser, idempresa, permisos, movimientos, permiso_gg, menu_gg_2)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [u.iduser, empresa, ...ueVals],
              );
            }

            // Unificar con el rol (solo si tiene documento, de lo contrario Firebird lanza error de constraint)
            if (!sinDoc) {
              await tx.query(
                `UPDATE usuario SET exclusion_permisos = 0 WHERE UPPER(TRIM(iduser)) = UPPER(TRIM(?))`,
                [u.iduser],
              );
            }
          });

          // usuario_concepto (server DB): reemplazar desde plantilla
          if (plantillaConceptos.length > 0) {
            await fbTx('server', async (tx) => {
              await tx.query(
                `DELETE FROM usuario_concepto WHERE UPPER(iduser) = UPPER(?)`,
                [u.iduser],
              );
              for (const c of plantillaConceptos) {
                await tx.query(
                  `INSERT INTO usuario_concepto
                     (iduser, idtipomovimiento, permiso, permiso_varios,
                      idtalonario, idvendedor, idpersona, idplanventa, idcondicion)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    u.iduser, c.idtipomovimiento, c.permiso, c.permiso_varios,
                    c.idtalonario ?? null, c.idvendedor ?? null, c.idpersona ?? null,
                    c.idplanventa ?? null, c.idcondicion ?? null,
                  ],
                );
              }
            }).catch(() => { /* server DB puede no tener tabla */ });
          }

          propagados++;
          if (sinDoc) sin_documento.push({ iduser: u.iduser });
        } catch (e) {
          errores.push({ iduser: u.iduser, mensaje: e?.message || 'error desconocido' });
        }
      }
    }

    return { propagados, excluidos: excCount, errores, sin_documento };
  },
};

module.exports = AccesosService;
