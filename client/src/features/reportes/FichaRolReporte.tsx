import type { FichaRol } from '../../api/endpoints';
import { Header, Seccion, DL, DT, DD, Chips, Badge, Vacio, ConceptosTable, ChecklistPermisos } from './FichaUsuarioReporte';

export default function FichaRolReporte({ data }: { data: FichaRol }) {
  const r = data.rol;

  const permActivos = (data.accesos.permisosGenerales.flags || [])
    .map((v, i) => (v ? data.accesos.permisosGenerales.catalogo[i]?.descripcion : null))
    .filter(Boolean) as string[];
  const pdvActivos = (data.accesos.pdv.flags || [])
    .map((v, i) => (v ? data.accesos.pdv.catalogo[i]?.descripcion : null))
    .filter(Boolean) as string[];
  const ggActivos = (data.accesos.permisoGg.flags || [])
    .map((v, i) => (v ? `GG ${i}` : null))
    .filter(Boolean) as string[];
  const movActivos = (data.accesos.movimientos.flags || [])
    .map((v, i) => (v ? `Mov ${i}` : null))
    .filter(Boolean) as string[];
  const menuHab = (data.accesos.menu || []).filter((m) => m.permiso === 1);
  const permCatalogo = data.accesos.permisosGenerales.catalogo || [];

  return (
    <div className="p-5 text-sm text-zinc-800 dark:text-zinc-100">
      <Header
        titulo="Ficha de Rol"
        subtitulo={`#${r.idperfil} — ${r.descripcion}`}
        generadoEn={data.generadoEn}
      />

      <Seccion titulo="Datos básicos">
        <DL>
          <DT>idperfil</DT><DD>{r.idperfil}</DD>
          <DT>Descripción</DT><DD>{r.descripcion}</DD>
          <DT>Plantilla (iduser)</DT><DD className="font-mono">{r.iduser}</DD>
          <DT>Tipo</DT><DD>{r.tipo}</DD>
          <DT>Estado</DT>
          <DD>{r.estado === 1
            ? <Badge color="green">Activo</Badge>
            : <Badge color="red">Inactivo</Badge>}</DD>
          <DT>Master</DT>
          <DD>{r.master
            ? <Badge color="brand">Sí</Badge>
            : <Badge color="zinc">No</Badge>}</DD>
          <DT>Edición de rol</DT>
          <DD>{r.edicion_rol
            ? <Badge color="amber">Editable por usuarios</Badge>
            : <Badge color="zinc">Solo plantilla</Badge>}</DD>
        </DL>
      </Seccion>

      <Seccion titulo={`Permisos generales (${permActivos.length} de ${permCatalogo.length} activos)`}>
        <ChecklistPermisos catalogo={permCatalogo} flags={data.accesos.permisosGenerales.flags || []} />
      </Seccion>

      <Seccion titulo={`Movimientos (${movActivos.length} activos)`}>
        {movActivos.length === 0 ? <Vacio>Ninguno.</Vacio> : <Chips items={movActivos} />}
      </Seccion>

      <Seccion titulo={`PDV / Caja (${pdvActivos.length} activos)`}>
        {pdvActivos.length === 0 ? <Vacio>Ninguno.</Vacio> : <Chips items={pdvActivos} />}
      </Seccion>

      <Seccion titulo={`Permisos GG (${ggActivos.length} activos)`}>
        {ggActivos.length === 0 ? <Vacio>Ninguno.</Vacio> : <Chips items={ggActivos} />}
      </Seccion>

      <Seccion titulo={`Menú habilitado (${menuHab.length} de ${data.accesos.menu.length})`}>
        {menuHab.length === 0 ? <Vacio>Sin ítems.</Vacio> : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-0.5 text-xs">
            {menuHab.map((m) => (
              <div key={m.idmenu_principal} className="truncate">
                <span className="text-zinc-400 font-mono">{m.idmenu}</span> {m.titulo}
              </div>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Conceptos por tipo de movimiento">
        <ConceptosTable data={data.conceptos} mostrarTodos />
      </Seccion>

      <Seccion titulo={`Usuarios asignados al rol (${data.usuariosAsignados.length})`}>
        {data.usuariosAsignados.length === 0 ? <Vacio>Sin usuarios.</Vacio> : (
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="py-1 pr-2">iduser</th>
                <th className="py-1 pr-2">Nombre</th>
                <th className="py-1 pr-2">Estado</th>
                <th className="py-1">Permisos</th>
              </tr>
            </thead>
            <tbody>
              {data.usuariosAsignados.map((u) => (
                <tr key={u.iduser} className="border-b border-zinc-100">
                  <td className="py-1 pr-2 font-mono">{u.iduser}</td>
                  <td className="py-1 pr-2">{u.apellido}, {u.nombre}</td>
                  <td className="py-1 pr-2">
                    {u.estado === 1
                      ? <Badge color="green">Activo</Badge>
                      : <Badge color="zinc">{u.estado}</Badge>}
                  </td>
                  <td className="py-1">
                    {u.exclusion_permisos
                      ? <Badge color="amber">Personalizado</Badge>
                      : <Badge color="zinc">Heredados</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Seccion>
    </div>
  );
}
