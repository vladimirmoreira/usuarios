'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');
const UsuarioModel          = require('../models/usuario.model');
const CatalogoModel         = require('../models/catalogo.model');
const UsuarioTurnoModel     = require('../models/usuarioTurno.model');
const UsuarioSucursalModel  = require('../models/usuarioSucursal.model');
const OperacionesService = require('../services/operaciones.service');
const { auditar, OP } = require('../utils/audit');
const { query }       = require('../config/firebird');
const logger          = require('../utils/logger');

const ipDe = (req) => req.headers['x-client-ip'] || req.ip;
const rptDe = (req) => req.user?.iduser || 'SYSTEM';

const UsuarioController = {
  async listar(req, res, next) {
    try {
      const [usuarios, sucBulk] = await Promise.all([
        UsuarioModel.listar(req.query),
        UsuarioSucursalModel.sucursalesBulk(),
      ]);
      // Tomar primera sucursal por usuario (ya vienen ordenadas)
      const sucMap = new Map();
      for (const row of sucBulk) {
        const key = String(row.iduser).toUpperCase().trim();
        if (!sucMap.has(key)) sucMap.set(key, row.sucursal_nombre);
      }
      res.json(usuarios.map((u) => ({
        ...u,
        sucursal_nombre: sucMap.get(String(u.iduser).toUpperCase().trim()) ?? null,
      })));
    } catch (e) { next(e); }
  },

  /** GET /api/usuarios/export.csv — CSV con los mismos filtros que `listar`. */
  async exportCsv(req, res, next) {
    try {
      const rows = await UsuarioModel.exportar(req.query);
      const ESTADO = { 0: 'Inactivo', 1: 'Activo', 2: 'Bloqueado' };
      const headers = ['iduser', 'nombre', 'apellido', 'documento', 'perfil', 'idtipo_usuario', 'estado'];
      const esc = (v) => {
        if (v == null) return '';
        const s = String(v);
        return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [headers.join(';')];
      for (const r of rows) {
        lines.push([
          r.iduser, r.nombre, r.apellido, r.documento, r.perfil || '-',
          r.idtipo_usuario, ESTADO[r.estado] ?? r.estado,
        ].map(esc).join(';'));
      }
      // BOM UTF-8 + CRLF para máxima compatibilidad con Excel.
      const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="usuarios_${stamp}.csv"`);
      res.send(csv);
    } catch (e) { next(e); }
  },

  async bloquearSinMenu(req, res, next) {
    try { await UsuarioModel.bloquearSinMenu(); res.json({ ok: true }); }
    catch (e) { next(e); }
  },

  async obtener(req, res, next) {
    try {
      const u = await UsuarioModel.findById(req.params.iduser);
      if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
      res.json(u);
    } catch (e) { next(e); }
  },

  async crear(req, res, next) {
    try {
      const rptUser = rptDe(req);
      const { foto, hasta_vigencia, ...rest } = req.body;

      // Unicidad de documento (validación server-side)
      if (await UsuarioModel.existeDocumento(rest.documento)) {
        return res.status(400).json({ error: 'El documento ya está registrado para otro usuario' });
      }

      // idperfil = 0 => "Sin Rol": alta sin plantilla (menú de Admin sin permisos).
      const result = Number(rest.idperfil) === 0
        ? await OperacionesService.altaSinRol({
            iduser: rest.iduser, nombre: rest.nombre, apellido: rest.apellido,
            documento: rest.documento, rptUser, ip: ipDe(req),
          })
        : await OperacionesService.altaUsuario({ ...rest, rptUser, ip: ipDe(req) });

      if (foto) {
        try { await UsuarioModel.actualizarFoto(rest.iduser, foto); } catch (_) { /* la foto no bloquea */ }
      }
      if (hasta_vigencia) {
        try { await UsuarioModel.setVigencia(rest.iduser, hasta_vigencia); } catch (_) { /* no bloquea el alta */ }
      }
      res.status(201).json(result);
    } catch (e) { next(e); }
  },

  async sugerirIduser(req, res, next) {
    try {
      const { nombre, apellido } = req.query;
      const sugerido = await UsuarioModel.sugerirIduser(nombre, apellido);
      res.json({ sugerido: sugerido || null });
    } catch (e) { next(e); }
  },

  async checkDocumento(req, res, next) {
    try {
      const { documento, excludeIduser } = req.query;
      const existe = await UsuarioModel.existeDocumento(documento, excludeIduser);
      res.json({ disponible: !existe });
    } catch (e) { next(e); }
  },

  async actualizar(req, res, next) {
    try {
      if (req.body.documento) {
        const docExiste = await UsuarioModel.existeDocumento(req.body.documento, req.params.iduser);
        if (docExiste) return res.status(400).json({ error: 'El documento ya está registrado para otro usuario' });
      }
      const r = await OperacionesService.actualizarCuenta({
        iduser: req.params.iduser, rptUser: rptDe(req), ip: ipDe(req),
        nombre: req.body.nombre, apellido: req.body.apellido, documento: req.body.documento,
      });
      if ('hasta_vigencia' in req.body) {
        try { await UsuarioModel.setVigencia(req.params.iduser, req.body.hasta_vigencia || null); } catch (_) { /* no bloquea */ }
      }
      res.json(r);
    } catch (e) { next(e); }
  },

  async dardeBaja(req, res, next) {
    try {
      const r = await OperacionesService.bajaUsuario({
        iduser: req.params.iduser, rptUser: rptDe(req), ip: ipDe(req),
      });
      res.json(r);
    } catch (e) { next(e); }
  },

  async reactivar(req, res, next) {
    try {
      const r = await OperacionesService.reactivar({
        iduser: req.params.iduser, rptUser: rptDe(req), ip: ipDe(req),
      });
      res.json(r);
    } catch (e) { next(e); }
  },

  async vincularLegajo(req, res, next) {
    try {
      const iduser = req.params.iduser;
      const u = await UsuarioModel.findById(iduser);
      if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (!u.documento) return res.status(400).json({ error: 'El usuario no tiene documento registrado' });
      const r = await OperacionesService.vincularLegajo({
        iduser, documento: u.documento, rptUser: rptDe(req), ip: ipDe(req),
      });
      res.json(r);
    } catch (e) { next(e); }
  },

  async resetClave(req, res, next) {
    try {
      const r = await OperacionesService.resetClave({
        iduser: req.params.iduser, rptUser: rptDe(req), ip: ipDe(req),
      });
      res.json(r);
    } catch (e) { next(e); }
  },

  /** Paso 1: genera código de verificación (simulado → se devuelve para mostrarlo). */
  async resetClaveIniciar(req, res, next) {
    try {
      const r = await OperacionesService.resetClaveIniciar({ iduser: req.params.iduser, ip: ipDe(req) });
      res.json(r);
    } catch (e) { next(e); }
  },

  /** Paso 2: verifica el código y aplica el reset (clave manual opcional). */
  async resetClaveConfirmar(req, res, next) {
    try {
      const r = await OperacionesService.resetClaveConfirmar({
        iduser: req.params.iduser, codigo: req.body.codigo, nuevaClave: req.body.nuevaClave,
        rptUser: rptDe(req), ip: ipDe(req),
      });
      res.json(r);
    } catch (e) { next(e); }
  },

  async reasignarSucursal(req, res, next) {
    try {
      const r = await OperacionesService.reasignarSucursal({
        iduser: req.params.iduser, rptUser: rptDe(req), ip: ipDe(req),
        idsucursal: req.body.idsucursal,
      });
      res.json(r);
    } catch (e) { next(e); }
  },

  async cambiarPerfil(req, res, next) {
    try {
      const r = await OperacionesService.cambiarPerfil({
        iduser: req.params.iduser, rptUser: rptDe(req), ip: ipDe(req),
        idperfil: req.body.idperfil,
      });
      res.json(r);
    } catch (e) { next(e); }
  },

  async obtenerComplemento(req, res, next) {
    try { res.json(await UsuarioModel.getComplemento(req.params.iduser)); }
    catch (e) { next(e); }
  },

  async actualizarComplemento(req, res, next) {
    try {
      const n = await UsuarioModel.updateComplemento(req.params.iduser, req.body);
      if (n) {
        const cambios = Object.keys(req.body).join(', ');
        await auditar(req, req.params.iduser, OP.ACTUALIZAR_CUENTA,
          `Preferencias empresa: ${cambios}`);
      }
      res.json({ ok: true, detalle: n ? undefined : 'Sin cambios' });
    } catch (e) { next(e); }
  },

  async historial(req, res, next) {
    try {
      res.json(await UsuarioModel.historial(req.params.iduser, {
        page: req.query.page, pageSize: req.query.pageSize,
      }));
    } catch (e) { next(e); }
  },

  async sucursalPrincipal(req, res, next) {
    try {
      const { query: fbQuery } = require('../config/firebird');
      const { decodeRows } = require('../utils/charset');
      const rows = await fbQuery(
        'server',
        `SELECT FIRST 1 us.idsucursal, CAST(s.nombre AS VARCHAR(120) CHARACTER SET OCTETS) AS nombre
           FROM usuario_sucursal us
           JOIN sucursal s ON s.idsucursal = us.idsucursal
          WHERE CAST(UPPER(TRIM(us.iduser)) AS VARCHAR(10) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(10) CHARACTER SET OCTETS)
          ORDER BY us.orden, us.idsucursal`,
        [String(req.params.iduser || '').trim().toUpperCase()],
      ).then((r) => decodeRows(r, ['nombre'])).catch(() => []);
      res.json(rows[0] || null);
    } catch (e) { next(e); }
  },

  /** GET /usuarios/:iduser/foto — sirve la imagen binaria (o 404 si no tiene). */
  async foto(req, res, next) {
    try {
      const buf = await UsuarioModel.getFotoRaw(req.params.iduser);
      if (!buf || !buf.length) return res.status(404).json({ error: 'El usuario no tiene foto' });
      let mime = 'image/jpeg';
      if (buf[0] === 0x89 && buf[1] === 0x50)      mime = 'image/png';
      else if (buf[0] === 0x47 && buf[1] === 0x49) mime = 'image/gif';
      else if (buf[0] === 0xff && buf[1] === 0xd8) mime = 'image/jpeg';
      else if (buf[0] === 0x52 && buf[1] === 0x49) mime = 'image/webp';
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(req.params.iduser)}.${mime.split('/')[1]}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.end(buf);
    } catch (e) { next(e); }
  },

  async turnosMes(req, res, next) {
    try {
      const { anio, mes } = req.query;
      const rows = await UsuarioTurnoModel.listarMes(
        req.params.iduser, Number(anio), Number(mes),
      );
      res.json(rows);
    } catch (e) { next(e); }
  },

  async guardarTurnosMes(req, res, next) {
    try {
      const { anio, mes, items } = req.body;
      const n = await UsuarioTurnoModel.reemplazarMes(
        req.params.iduser, Number(anio), Number(mes), items,
      );
      await auditar(req, req.params.iduser, OP.ACTUALIZAR_CUENTA,
        `Programación sucursal: ${n} día(s) en ${mes}/${anio}`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },

  /* ─── Importación masiva ───────────────────────────────────────────── */
  async importar(req, res, next) {
    try {
      const filas   = req.body.filas;          // array validado por Zod
      const rptUser = rptDe(req);
      const ip      = ipDe(req);

      // 1. Cargar catálogos
      // perfiles: activos (para asignar) + todos (para distinguir "no existe" de "no habilitado")
      const [sucursales, perfiles, todosPerfiles] = await Promise.all([
        CatalogoModel.sucursales(),
        CatalogoModel.perfiles({ estado: 1 }),
        CatalogoModel.perfiles(),
      ]);
      const sucSet        = new Set(sucursales.map((s) => Number(s.idsucursal)));
      const perfilById    = new Map(perfiles.map((p) => [Number(p.idtipo_usuario), p]));
      const perfilByDesc  = new Map(perfiles.map((p) => [p.descripcion.toUpperCase().trim(), p]));
      // mapas de todos los perfiles (para mensaje de error preciso)
      const todoById      = new Map(todosPerfiles.map((p) => [Number(p.idtipo_usuario), p]));
      const todoByDesc    = new Map(todosPerfiles.map((p) => [p.descripcion.toUpperCase().trim(), p]));

      // 2. Validar cada fila
      const errores   = [];
      const validos   = [];
      const docsEnLote= new Set();

      for (let i = 0; i < filas.length; i++) {
        const fila = i + 1;
        const { nombre = '', apellido = '', documento = '', perfil = '', idsucursal } = filas[i];
        const rowErr = [];

        if (!nombre.trim())   rowErr.push('nombre: requerido');
        else if (nombre.trim().length > 25)   rowErr.push(`nombre: máximo 25 caracteres (recibido ${nombre.trim().length})`);
        if (!apellido.trim()) rowErr.push('apellido: requerido');
        else if (apellido.trim().length > 25) rowErr.push(`apellido: máximo 25 caracteres (recibido ${apellido.trim().length})`);

        // Documento
        const doc = String(documento).trim();
        if (!doc || doc.length < 5 || doc.length > 12) {
          rowErr.push(`documento: debe tener entre 5 y 12 caracteres (recibido: "${doc}")`);
        } else if (docsEnLote.has(doc)) {
          rowErr.push(`documento: "${doc}" duplicado en el archivo`);
        } else if (await UsuarioModel.existeDocumento(doc)) {
          rowErr.push(`documento: "${doc}" ya registrado en la base de datos`);
        } else {
          docsEnLote.add(doc);
        }

        // Perfil
        let perfilObj = null;
        const perfilStr = String(perfil).trim();
        if (!perfilStr) {
          rowErr.push('perfil: requerido');
        } else {
          const perfilNum = Number(perfilStr);
          if (!isNaN(perfilNum) && Number.isInteger(perfilNum)) perfilObj = perfilById.get(perfilNum);
          if (!perfilObj) perfilObj = perfilByDesc.get(perfilStr.toUpperCase());
          if (!perfilObj) {
            // Distinguir si existe pero está deshabilitado
            const existeInactivo =
              (!isNaN(Number(perfilStr)) && todoById.has(Number(perfilStr))) ||
              todoByDesc.has(perfilStr.toUpperCase());
            rowErr.push(
              existeInactivo
                ? `perfil: "${perfilStr}" existe pero no está habilitado`
                : `perfil: "${perfilStr}" no existe (use id o descripción exacta)`,
            );
          } else if (!perfilObj.iduser) {
            // Perfil existe y está activo, pero no tiene usuario-plantilla configurado
            rowErr.push(
              `perfil: "${perfilObj.descripcion}" no tiene usuario-plantilla configurado (asignarlo en Roles)`,
            );
            perfilObj = null; // invalidar para que no pase a válidos
          } else if (Number(perfilObj.permisos_activos ?? 0) === 0) {
            // El rol no tiene ningún permiso de menú activo: importarlo dejaría a los
            // usuarios sin accesos. Se bloquea hasta configurar los permisos del rol.
            rowErr.push(
              `perfil: "${perfilObj.descripcion}" no tiene permisos activos. Configurá primero los permisos del rol antes de importar.`,
            );
            perfilObj = null;
          }
        }

        // Sucursal
        const sucId = Number(idsucursal);
        if (isNaN(sucId) || !sucSet.has(sucId)) {
          rowErr.push(`idsucursal: ${idsucursal} no existe o no está activa`);
        }

        if (rowErr.length) {
          errores.push({ fila, nombre: nombre.trim(), apellido: apellido.trim(), documento: doc, errores: rowErr });
        } else {
          validos.push({ fila, nombre: nombre.trim(), apellido: apellido.trim(), documento: doc,
            idperfil: perfilObj.idtipo_usuario, perfilDesc: perfilObj.descripcion, idsucursal: sucId });
        }
      }

      // 3. Generar iduser para filas válidas (respetando reservas del lote)
      const reservadosEnLote = new Set();
      for (const p of validos) {
        const iduser = await _sugerirUnico(p.nombre, p.apellido, reservadosEnLote);
        if (!iduser) {
          errores.push({ fila: p.fila, nombre: p.nombre, apellido: p.apellido, documento: p.documento,
            errores: ['iduser: no se pudo generar un identificador único (combinaciones agotadas)'] });
          p._skip = true;
        } else {
          reservadosEnLote.add(iduser);
          p.iduser = iduser;
        }
      }

      // 4. Si hay errores: escribir TXT en escritorio y devolver lista
      if (errores.length) {
        const fecha = new Date();
        const dd   = String(fecha.getDate()).padStart(2, '0');
        const mm   = String(fecha.getMonth() + 1).padStart(2, '0');
        const aaaa = fecha.getFullYear();
        const nombreArchivo = `errImportacionUsuario_${dd}${mm}${aaaa}.txt`;
        // En Windows usar USERPROFILE para rutas con OneDrive/redirección de carpetas
        const homeDir    = process.platform === 'win32'
          ? (process.env.USERPROFILE || os.homedir())
          : os.homedir();
        const desktopPath = path.join(homeDir, 'Desktop');
        const filePath    = path.join(desktopPath, nombreArchivo);

        const lineas = [`Errores de importación de usuarios — ${dd}/${mm}/${aaaa}`, ''];
        for (const e of errores) {
          lineas.push(`Fila ${e.fila}: ${e.nombre} ${e.apellido} — documento: ${e.documento || '(vacío)'}`);
          for (const msg of e.errores) lineas.push(`  · ${msg}`);
          lineas.push('');
        }

        let archivoEscrito  = null;
        let errorEscritura  = null;
        try {
          fs.mkdirSync(desktopPath, { recursive: true });
          fs.writeFileSync(filePath, lineas.join('\r\n'), 'utf8');
          archivoEscrito = filePath;
        } catch (writeErr) {
          logger.warn({ err: writeErr.message }, 'No se pudo escribir archivo de errores en escritorio');
          errorEscritura = writeErr.message;
        }
        return res.status(422).json({
          ok: false,
          errores,
          archivoErrores:      archivoEscrito,
          errorEscrituraArchivo: errorEscritura,
        });
      }

      // 5. Alta atómica del lote (todo o nada en system DB)
      const loteValido = validos.filter((p) => !p._skip);
      let importados        = [];
      let erroresEjecucion  = [];

      try {
        const resultado = await OperacionesService.altasBatch(loteValido, { rptUser, ip });
        importados       = resultado.importados;
        erroresEjecucion = resultado.erroresPostefecto.map((e) => ({
          fila: e.fila, iduser: e.iduser, mensaje: `Post-efecto: ${e.mensaje}`,
        }));
      } catch (batchErr) {
        // La transacción hizo ROLLBACK — ningún usuario fue grabado
        erroresEjecucion = [{
          fila:   batchErr.fila   ?? 0,
          iduser: batchErr.iduser ?? '',
          mensaje: batchErr.message,
        }];
      }

      res.json({ ok: true, importados, erroresEjecucion });
    } catch (e) { next(e); }
  },
};

/**
 * Genera un iduser único considerando tanto la BD como los ya reservados en el lote actual.
 * Replica la lógica de UsuarioModel.sugerirIduser pero recibe el Set de reservas del lote.
 */
async function _sugerirUnico(nombre, apellido, reservadosEnLote) {
  const n   = nombre.trim().toUpperCase().replace(/[^A-Z]/g, '');
  const partes = apellido.trim().toUpperCase().split(/\s+/).map((p) => p.replace(/[^A-Z]/g, '')).filter(Boolean);
  const ap1 = partes[0] || '';
  const ap2 = partes[1] || '';

  const visto = new Set();
  const candidatos = [];
  const add = (raw) => { const c = raw.slice(0, 10); if (!visto.has(c)) { visto.add(c); candidatos.push(c); } };
  for (let i = 1; i <= n.length; i++) add(n.slice(0, i) + ap1);
  if (ap2) for (let i = 1; i <= n.length; i++) add(n.slice(0, i) + ap1 + ap2);
  if (!candidatos.length) return null;

  const placeholders = candidatos.map(() => '?').join(', ');
  const rows = await query(
    'system',
    `SELECT UPPER(TRIM(iduser)) AS iduser FROM usuario WHERE UPPER(TRIM(iduser)) IN (${placeholders})`,
    candidatos,
  );
  const existentesDb = new Set(rows.map((r) => String(r.iduser).toUpperCase().trim()));

  for (const c of candidatos) {
    if (!existentesDb.has(c) && !reservadosEnLote.has(c)) return c;
  }
  return null;
}

module.exports = UsuarioController;
