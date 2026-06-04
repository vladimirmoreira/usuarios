/* ============================================================
   Migración 07 — Campo METADATA_EJECUTADO
   Agrega el control de inicialización de metadatos a la tabla
   CONFIGURACION_USUARIO (BD server_*).

   Instrucciones:
     Ejecutar una sola vez contra CADA base de datos server_*.
     Si el campo ya existe, Firebird lanzará un error que
     puede ignorarse de forma segura.
   ============================================================ */

ALTER TABLE CONFIGURACION_USUARIO
  ADD METADATA_EJECUTADO SMALLINT DEFAULT 0 NOT NULL;

/* Comentario:
   METADATA_EJECUTADO = 0 → inicialización de metadatos pendiente (permite ejecutar).
   METADATA_EJECUTADO = 1 → metadatos ya inicializados (bloquea nueva ejecución).
   El campo se actualiza a 1 al completarse exitosamente la inicialización
   desde el endpoint POST /api/configuracion/metadata/ejecutar.
*/
