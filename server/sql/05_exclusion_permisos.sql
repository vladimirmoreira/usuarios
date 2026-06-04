-- =========================================================
--  Migración: exclusion_permisos en USUARIO
--  Fecha: 2026-05-30
-- =========================================================
--  Uso: node sql/run-migration.js 05_exclusion_permisos.sql
-- =========================================================

-- ---------------------------------------------------------
-- [system] Campo que indica si el usuario fue excluido de la
-- última propagación de permisos desde su rol.
-- 0 = permisos unificados con el rol
-- 1 = permisos personalizados (fue excluido de una propagación)
-- ---------------------------------------------------------
ALTER TABLE USUARIO ADD EXCLUSION_PERMISOS SMALLINT DEFAULT 0;
