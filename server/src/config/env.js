'use strict';

require('dotenv').config();
const { z } = require('zod');

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5175'),

  DEFAULT_IDEMPRESA: z.string().default('1'),
  // Empresa de la BD MASTER (Contab./RRHH). Master suele ser mono-empresa; este es
  // el fallback cuando no hay mapeo EMPRESAS.idempresa_system para la empresa system.
  MASTER_IDEMPRESA: z.string().default('1'),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  SYSTEM_HOST: z.string(),
  SYSTEM_PORT: z.coerce.number().default(3050),
  SYSTEM_DATABASE: z.string(),
  SYSTEM_USER: z.string(),
  SYSTEM_PASSWORD: z.string(),
  SYSTEM_CHARSET: z.string().default('NONE'),

  SERVER_HOST: z.string(),
  SERVER_PORT: z.coerce.number().default(3050),
  SERVER_DATABASE: z.string(),
  SERVER_USER: z.string(),
  SERVER_PASSWORD: z.string(),
  SERVER_CHARSET: z.string().default('NONE'),

  // BD MASTER (Contabilidad / RRHH). Opcional: si no está configurada se omite la replicación.
  MASTER_HOST: z.string().optional(),
  MASTER_PORT: z.coerce.number().default(3050),
  MASTER_DATABASE: z.string().optional(),
  MASTER_USER: z.string().optional(),
  MASTER_PASSWORD: z.string().optional(),
  MASTER_CHARSET: z.string().default('NONE'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = parsed.data;
