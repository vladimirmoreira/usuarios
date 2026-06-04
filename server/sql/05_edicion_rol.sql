-- ============================================================
-- Migración 05: campo edicion_rol en tipo_usuario
-- 0 = los permisos del usuario se pueden editar directamente
-- 1 = solo se pueden editar a través del rol (lectura en las
--     pestañas Menú, Permisos Generales, Movimientos, PDV y
--     Contab/RRHH; Sucursales y Depósitos siguen siendo libres)
-- ============================================================

-- Agregar columna (si ya existe, esta sentencia fallará sin afectar el resto)
ALTER TABLE tipo_usuario ADD edicion_rol SMALLINT DEFAULT 0;

-- Valor por defecto para todos los roles existentes
UPDATE tipo_usuario SET edicion_rol = 0 WHERE edicion_rol IS NULL;

-- Establecer en 1 para los perfiles de ejemplo (7 y 8)
UPDATE tipo_usuario SET edicion_rol = 1 WHERE idtipo_usuario IN (7, 8);

COMMIT;
