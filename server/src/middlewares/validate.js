'use strict';

/**
 * Middleware genérico de validación con Zod.
 * @param {{body?: any, query?: any, params?: any}} schemas
 */
module.exports = function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: err.errors });
    }
  };
};
