'use strict';

const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {
  logger.error({ err, url: req.originalUrl }, 'Unhandled error');
  const status = err.status || 500;
  res.status(status).json({
    error: err.expose ? err.message : 'Error interno del servidor',
    code: err.code,
  });
};
