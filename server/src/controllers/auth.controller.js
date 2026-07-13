'use strict';

const bcrypt = require('bcryptjs');
const UsuarioModel = require('../models/usuario.model');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { auditarDirecto, OP } = require('../utils/audit');

const ipDeReq = (req) => req.headers['x-client-ip'] || req.ip || '';

const AuthController = {
  /**
   * Login multi-empresa en 2 fases sobre el MISMO endpoint:
   *   1) { iduser, pass }            → valida credenciales globales. Si el usuario
   *      tiene >1 empresa accesible, responde { multiEmpresa:true, empresas:[…] }
   *      SIN token (el front muestra el combo).
   *   2) { iduser, pass, idempresa } → re-valida credenciales + que la empresa esté
   *      entre las accesibles, y emite el JWT scopeado a esa empresa.
   * Con 1 sola empresa accesible entra directo (sin combo).
   */
  async login(req, res, next) {
    const iduser = (req.body?.iduser || '').toString().trim();
    const ip = ipDeReq(req);
    try {
      const { pass, idempresa } = req.body;
      // USUARIO es global (1 fila por iduser); la empresa se resuelve aparte.
      const user = iduser ? await UsuarioModel.findGlobal(iduser) : null;
      if (!user) {
        if (iduser) auditarDirecto({ iduser, idoperacion: OP.LOGIN_FALLIDO, rptUser: iduser,
          observacion: `Credenciales inválidas (usuario inexistente) ip=${ip}` });
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Soporta passwords legacy (texto plano en Firebird) y bcrypt
      const stored = (user.pass || '').trim();
      const ok = stored.startsWith('$2')
        ? await bcrypt.compare(pass, stored)
        : stored === pass;

      if (!ok) {
        auditarDirecto({ iduser: user.iduser, idoperacion: OP.LOGIN_FALLIDO, rptUser: user.iduser,
          observacion: `Clave incorrecta ip=${ip}` });
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Vigencia: si el usuario tiene fecha de caducidad y ya pasó, no permite ingresar.
      if (user.hasta_vigencia && new Date(user.hasta_vigencia) < new Date()) {
        auditarDirecto({ iduser: user.iduser, idoperacion: OP.LOGIN_FALLIDO, rptUser: user.iduser,
          observacion: `Vigencia vencida (${user.hasta_vigencia}) ip=${ip}` });
        return res.status(403).json({ error: 'Su acceso está vencido. Contacte al administrador.' });
      }

      // Empresas accesibles = usuarioempresa ∩ EMPRESAS.accesible ∩ gate del módulo.
      const empresas = await UsuarioModel.empresasAccesibles(user.iduser);
      if (!empresas.length) {
        auditarDirecto({ iduser: user.iduser, idoperacion: OP.LOGIN_FALLIDO, rptUser: user.iduser,
          observacion: `Sin acceso al módulo (mnuArchivoPanelControl) ip=${ip}` });
        return res.status(403).json({ error: 'No tiene acceso al módulo de Usuarios. Contacte al administrador.' });
      }

      // Resolver la empresa efectiva.
      let elegida;
      const sel = idempresa != null ? String(idempresa).trim() : '';
      if (sel !== '') {
        // Fase 2: la empresa elegida debe estar entre las accesibles (no otorga acceso nuevo).
        elegida = empresas.find((e) => e.idempresa === sel);
        if (!elegida) {
          auditarDirecto({ iduser: user.iduser, idoperacion: OP.LOGIN_FALLIDO, rptUser: user.iduser,
            observacion: `Empresa ${sel} no permitida ip=${ip}` });
          return res.status(403).json({ error: 'No tiene acceso a la empresa seleccionada.' });
        }
      } else if (empresas.length === 1) {
        elegida = empresas[0];
      } else {
        // >1 empresa y no eligió aún → devolver la lista para el combo (sin token).
        return res.json({ multiEmpresa: true, empresas });
      }

      const payload = {
        iduser: user.iduser,
        idperfil: user.idtipo_usuario,
        idempresa: elegida.idempresa,
      };
      auditarDirecto({ iduser: user.iduser, idoperacion: OP.LOGIN, rptUser: user.iduser,
        observacion: `Login OK empresa=${elegida.idempresa} ip=${ip}` });
      res.json({
        accessToken: signAccess(payload),
        refreshToken: signRefresh({ iduser: user.iduser, idempresa: elegida.idempresa }),
        usuario: {
          iduser: user.iduser,
          nombre: user.nombre,
          apellido: user.apellido,
          idperfil: user.idtipo_usuario,
          idempresa: elegida.idempresa,
          empresaNombre: elegida.nombre,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      const data = verifyRefresh(refreshToken);
      const user = await UsuarioModel.findById(data.iduser);
      if (!user || user.estado !== 1) return res.status(401).json({ error: 'No autorizado' });
      const payload = {
        iduser: user.iduser,
        idperfil: user.idtipo_usuario,
        // Preservar la empresa elegida en el login (multi-empresa); fallback a la de origen.
        idempresa: data.idempresa || user.idempresa,
      };
      res.json({ accessToken: signAccess(payload) });
    } catch {
      return res.status(401).json({ error: 'Refresh token inválido' });
    }
  },
};

module.exports = AuthController;
