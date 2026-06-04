-- =========================================================
--  Migración: inactividad de usuarios
--  Fecha: 2026-05-29
--  Ejecutar:  node sql/run-migration.js sql/04_inactividad.sql
-- =========================================================
--  Idempotente: si índices/columnas ya existen el runner los
--  reporta como WARN y continúa.
-- =========================================================

-- [server] umbral configurable de inactividad (días) por instalación
ALTER TABLE CONFIGURACION_USUARIO ADD DIAS_INACTIVIDAD INTEGER DEFAULT 90 NOT NULL;

-- [server] índices para acelerar GROUP BY usuario / MAX(fecha) en REGISTRO
CREATE INDEX IDX_REGISTRO_USUARIO       ON REGISTRO (USUARIO);
CREATE DESCENDING INDEX IDX_REGISTRO_FECHA_DESC ON REGISTRO (FECHA);
