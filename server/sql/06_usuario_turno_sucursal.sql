-- =========================================================
--  Migración: Turnos/programación de sucursal por usuario
--  Fecha: 2026-05-30
-- =========================================================
--  Uso: node sql/run-migration.js 06_usuario_turno_sucursal.sql
-- =========================================================

-- [system] Tabla de días programados para un usuario en una sucursal
CREATE TABLE USUARIO_TURNO_SUCURSAL (
  ID          INTEGER     NOT NULL,
  IDUSER      VARCHAR(10) NOT NULL,
  IDSUCURSAL  INTEGER     NOT NULL,
  FECHA       VARCHAR(10) NOT NULL,
  CONSTRAINT PK_UTS PRIMARY KEY (ID)
);

-- [system] Generador de PKs
CREATE GENERATOR GEN_USUARIO_TURNO_SUCURSAL;
SET GENERATOR GEN_USUARIO_TURNO_SUCURSAL TO 0;

-- [system] Índice para búsqueda por usuario+fecha
CREATE INDEX IDX_UTS_USER_FECHA ON USUARIO_TURNO_SUCURSAL (IDUSER, FECHA);
