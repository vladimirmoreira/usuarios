'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccess(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES, algorithm: 'HS256' });
}

function signRefresh(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES,
    algorithm: 'HS256',
  });
}

function verifyAccess(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

function verifyRefresh(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
