'use strict';

const bcrypt = require('bcryptjs');
const UsuarioModel = require('../models/usuario.model');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const env = require('../config/env');
const { auditarDirecto, OP } = require('../utils/audit');

const ipDeReq = (req) => req.headers['x-client-ip'] || req.ip || '';

const AuthController = {
  async login(req, res, next) {
    const iduser = (req.body?.iduser || '').toString().trim();
    const ip = ipDeReq(req);
    try {
      const { pass, idempresa } = req.body;
      const empresa = idempresa || env.DEFAULT_IDEMPRESA;
      const user = iduser ? await UsuarioModel.findByCredentials(iduser, empresa) : null;
      if (!user) {
        if (iduser) auditarDirecto({ iduser, idoperacion: OP.LOGIN_FALLIDO, rptUser: iduser,
          observacion: `Credenciales inválidas (usuario inexistente o empresa ${empresa}) ip=${ip}` });
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

      // Gate de acceso al módulo: requiere menu_general 'mnuArchivoPanelControl' (permiso=1).
      if (!(Number(user.acceso_modulo) > 0)) {
        auditarDirecto({ iduser: user.iduser, idoperacion: OP.LOGIN_FALLIDO, rptUser: user.iduser,
          observacion: `Sin acceso al módulo (mnuArchivoPanelControl) ip=${ip}` });
        return res.status(403).json({ error: 'No tiene acceso al módulo de Usuarios. Contacte al administrador.' });
      }

      const payload = {
        iduser: user.iduser,
        idperfil: user.idtipo_usuario,
        idempresa: user.idempresa,
      };
      auditarDirecto({ iduser: user.iduser, idoperacion: OP.LOGIN, rptUser: user.iduser,
        observacion: `Login OK ip=${ip}` });
      res.json({
        accessToken: signAccess(payload),
        refreshToken: signRefresh({ iduser: user.iduser }),
        usuario: {
          iduser: user.iduser,
          nombre: user.nombre,
          apellido: user.apellido,
          idperfil: user.idtipo_usuario,
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
        idempresa: user.idempresa,
      };
      res.json({ accessToken: signAccess(payload) });
    } catch {
      return res.status(401).json({ error: 'Refresh token inválido' });
    }
  },
};

module.exports = AuthController;
