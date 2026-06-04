-- =========================================================
--  Migración: poblar TIPO_OPERACION con todos los valores
--  del catálogo (operaciones.config.js)
--  BD destino: server  (project_server.fdb)
--  Ejecutar: node sql/run-migration.js 03_login_audit.sql
--  Idempotente: el runner ignora "duplicate value" como WARN.
-- =========================================================

-- [server] catálogo completo de operaciones
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (1,  'Alta de Usuario');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (2,  'Baja de Usuario');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (3,  'Reinicio de Clave');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (4,  'Eliminación de Huella');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (5,  'Reasignación de Sucursal');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (6,  'Cambio de Perfil');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (7,  'Actualización de Cuenta');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (8,  'Vinculación con Legajo');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (9,  'Exclusion de Cuenta');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (10, 'Migración de Datos');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (11, 'Re-Activar Cuenta');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (12, 'Inicio de Sesión');
INSERT INTO TIPO_OPERACION (IDTIPO_OPERACION, DESCRIPCION) VALUES (13, 'Intento de Login Fallido');
