import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, UserCircle, Shield, Loader2 } from 'lucide-react';
import { ReportesAPI, UsuariosAPI, RolesAPI } from '../../api/endpoints';
import type { Usuario, Rol } from '../../api/endpoints';
import FichaUsuarioReporte from './FichaUsuarioReporte';
import FichaRolReporte from './FichaRolReporte';

type TipoFicha = 'usuario' | 'rol';

export default function ReportesPage() {
  const [tipo, setTipo] = useState<TipoFicha>('usuario');
  const [iduser, setIduser] = useState<string>('');
  const [idperfil, setIdperfil] = useState<number | ''>('');
  const [busqueda, setBusqueda] = useState('');

  // Catálogo de usuarios (para el combo)
  const usuariosQ = useQuery({
    queryKey: ['reportes', 'usuarios'],
    queryFn: () => UsuariosAPI.listar({}),
    staleTime: 60_000,
  });
  // Catálogo de roles
  const rolesQ = useQuery({
    queryKey: ['reportes', 'roles'],
    queryFn: () => RolesAPI.listar({ estado: 1 }),
    staleTime: 60_000,
  });

  // Datos de la ficha seleccionada
  const fichaUsuarioQ = useQuery({
    queryKey: ['reporte', 'usuario', iduser],
    queryFn:  () => ReportesAPI.fichaUsuario(iduser),
    enabled:  tipo === 'usuario' && !!iduser,
  });
  const fichaRolQ = useQuery({
    queryKey: ['reporte', 'rol', idperfil],
    queryFn:  () => ReportesAPI.fichaRol(idperfil as number),
    enabled:  tipo === 'rol' && idperfil !== '',
  });

  const usuariosFiltrados = useMemo(() => {
    const all: Usuario[] = usuariosQ.data ?? [];
    const q = busqueda.trim().toUpperCase();
    if (!q) return all.slice(0, 200);
    return all.filter(
      (u) =>
        (u.iduser || '').toUpperCase().includes(q) ||
        (u.nombre || '').toUpperCase().includes(q) ||
        (u.apellido || '').toUpperCase().includes(q) ||
        (u.documento || '').includes(q),
    ).slice(0, 200);
  }, [usuariosQ.data, busqueda]);

  const roles: Rol[] = rolesQ.data ?? [];

  const handlePrint = () => window.print();

  const hayDatos =
    (tipo === 'usuario' && fichaUsuarioQ.data) ||
    (tipo === 'rol'     && fichaRolQ.data);

  return (
    <div className="space-y-4">
      {/* Toolbar — oculto en impresión */}
      <div className="print:hidden flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          <div className="text-xs font-semibold text-zinc-500 mb-1">Tipo de ficha</div>
          <div className="inline-flex rounded-md border border-zinc-300 bg-white text-sm dark:border-zinc-600 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setTipo('usuario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${
                tipo === 'usuario'
                  ? 'bg-brand-600 text-white'
                  : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700'
              } rounded-l-md`}
            >
              <UserCircle className="h-3.5 w-3.5" /> Usuario
            </button>
            <button
              type="button"
              onClick={() => setTipo('rol')}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${
                tipo === 'rol'
                  ? 'bg-brand-600 text-white'
                  : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700'
              } rounded-r-md`}
            >
              <Shield className="h-3.5 w-3.5" /> Rol
            </button>
          </div>
        </div>

        {tipo === 'usuario' ? (
          <>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-zinc-500 mb-1 block">Buscar</label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="iduser, nombre, apellido, documento…"
                className="input w-full py-1.5 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[260px]">
              <label className="text-xs font-semibold text-zinc-500 mb-1 block">Usuario</label>
              <select
                value={iduser}
                onChange={(e) => setIduser(e.target.value)}
                className="input w-full py-1.5 text-sm"
              >
                <option value="">— seleccionar —</option>
                {usuariosFiltrados.map((u) => (
                  <option key={u.iduser} value={u.iduser}>
                    {u.iduser} — {u.apellido} {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs font-semibold text-zinc-500 mb-1 block">Rol</label>
            <select
              value={idperfil}
              onChange={(e) => setIdperfil(e.target.value === '' ? '' : Number(e.target.value))}
              className="input w-full py-1.5 text-sm"
            >
              <option value="">— seleccionar —</option>
              {roles
                .filter((r) => r.idtipo_usuario !== -1) /* "Sin Asignación" no es un rol reporteable */
                .map((r) => (
                <option key={r.idtipo_usuario} value={r.idtipo_usuario}>
                  {r.descripcion}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={handlePrint}
          disabled={!hayDatos}
          className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-40"
          title="Imprimir / Exportar a PDF"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      {/* Contenido — ficha */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900 print:border-0 print:shadow-none">
        {tipo === 'usuario' && (
          <>
            {!iduser && <Placeholder texto="Seleccioná un usuario para generar la ficha." />}
            {iduser && fichaUsuarioQ.isLoading && <Spinner />}
            {iduser && fichaUsuarioQ.isError && (
              <p className="p-8 text-center text-sm text-red-600">
                Error al cargar la ficha del usuario.
              </p>
            )}
            {iduser && fichaUsuarioQ.data && <FichaUsuarioReporte data={fichaUsuarioQ.data} />}
          </>
        )}
        {tipo === 'rol' && (
          <>
            {idperfil === '' && <Placeholder texto="Seleccioná un rol para generar la ficha." />}
            {idperfil !== '' && fichaRolQ.isLoading && <Spinner />}
            {idperfil !== '' && fichaRolQ.isError && (
              <p className="p-8 text-center text-sm text-red-600">
                Error al cargar la ficha del rol.
              </p>
            )}
            {idperfil !== '' && fichaRolQ.data && <FichaRolReporte data={fichaRolQ.data} />}
          </>
        )}
      </div>
    </div>
  );
}

function Placeholder({ texto }: { texto: string }) {
  return <p className="p-12 text-center text-sm text-zinc-400 italic">{texto}</p>;
}
function Spinner() {
  return (
    <div className="p-12 flex items-center justify-center text-zinc-500">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
