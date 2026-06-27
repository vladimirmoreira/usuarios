'use strict';

const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const inactividadJob    = require('./jobs/inactividad.job');
const turnoSucursalJob  = require('./jobs/turnoSucursal.job');
const vigenciaJob       = require('./jobs/vigencia.job');

const server = app.listen(env.PORT, () => {
  logger.info(`API Usuarios escuchando en http://localhost:${env.PORT}`);
  inactividadJob.start();
  turnoSucursalJob.start();
  vigenciaJob.start();
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
