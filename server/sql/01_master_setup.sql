-- =========================================================
--  Migraci\u00f3n: soporte de replicaci\u00f3n a BD MASTER
--  Fecha: 2026-05-29
-- =========================================================
-- Ejecutar cada bloque contra la BD que corresponde.
-- En la app se corre mediante: node sql/run-migration.js
-- =========================================================

-- ---------------------------------------------------------
-- [system] flag MASTER en TIPO_USUARIO
-- ---------------------------------------------------------
ALTER TABLE TIPO_USUARIO ADD MASTER INTEGER DEFAULT 0 NOT NULL;

-- ---------------------------------------------------------
-- [server] flags Contabilidad / Talento Humano por IP
-- ---------------------------------------------------------
ALTER TABLE CONFIGURACION_USUARIO ADD CONTABILIDAD    INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE CONFIGURACION_USUARIO ADD TALENTO_HUMANO  INTEGER DEFAULT 0 NOT NULL;

-- ---------------------------------------------------------
-- [master] cat\u00e1logo de los 9 permisos
-- ---------------------------------------------------------
CREATE TABLE TMP$USUARIO_PERMISOS_MASTER (
  POSICION INTEGER     NOT NULL,
  TITULO   VARCHAR(60) NOT NULL,
  GRUPO    VARCHAR(20) NOT NULL,
  CONSTRAINT PK_TMP_PERM_MASTER PRIMARY KEY (POSICION)
);

INSERT INTO TMP$USUARIO_PERMISOS_MASTER (POSICION, TITULO, GRUPO) VALUES (1, 'Agregar',           'GENERAL');
INSERT INTO TMP$USUARIO_PERMISOS_MASTER (POSICION, TITULO, GRUPO) VALUES (2, 'Modificar',         'GENERAL');
INSERT INTO TMP$USUARIO_PERMISOS_MASTER (POSICION, TITULO, GRUPO) VALUES (3, 'Eliminar',          'GENERAL');
INSERT INTO TMP$USUARIO_PERMISOS_MASTER (POSICION, TITULO, GRUPO) VALUES (4, 'Imprimir',          'GENERAL');
INSERT INTO TMP$USUARIO_PERMISOS_MASTER (POSICION, TITULO, GRUPO) VALUES (5, 'Administrador',     'ADMIN');
INSERT INTO TMP$USUARIO_PERMISOS_MASTER (POSICION, TITULO, GRUPO) VALUES (6, 'Conf. Reportes',    'ADMIN');
INSERT INTO TMP$USUARIO_PERMISOS_MASTER (POSICION, TITULO, GRUPO) VALUES (7, 'RRHH Grupos',       'RRHH');
INSERT INTO TMP$USUARIO_PERMISOS_MASTER (POSICION, TITULO, GRUPO) VALUES (8, 'RRHH Supervisor',   'RRHH');
INSERT INTO TMP$USUARIO_PERMISOS_MASTER (POSICION, TITULO, GRUPO) VALUES (9, 'RRHH Areas',        'RRHH');
