'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const errorHandler = require('./middlewares/error');

const app = express();

app.disable('x-powered-by');
// Detrás de nginx (reverse proxy): confiar en el primer proxy para leer X-Forwarded-For
// (necesario para req.ip correcto y para que express-rate-limit no falle).
app.set('trust proxy', 1);
app.use(helmet());
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (ej: mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origen no permitido: ${origin}`));
  },
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

// Charset UTF-8 explícito
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use(
  '/api',
  rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }),
);

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api', routes);

app.use((req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));
app.use(errorHandler);

module.exports = app;
