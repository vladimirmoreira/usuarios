import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, X, Users, Sliders, AlertTriangle, CheckSquare, Square, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { RolesAPI, type RolUsuario } from '../../api/endpoints';

type Props = {
  idperfil: number;
  rolNombre: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function PropagateRolModal({ idperfil, rolNombre, onClose, onSuccess }: Props) {
  // excluidos = conjunto de iduser que NO recibirán los permisos
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [erroresProp, setErroresProp] = useState<{ iduser: string; mensaje: string }[]>([]);
  const [sinDocProp,  setSinDocProp]  = useState<{ iduser: string }[]>([]);

  const usuariosQ = useQuery({
    queryKey: ['roles', idperfil, 'usuarios'],
    queryFn: () => RolesAPI.listarUsuarios(idperfil),
    staleTime: 30_000,
  });

  const usuarios: RolUsuario[] = usuariosQ.data ?? [];

  // Pre-marcar como excluidos a quienes ya tienen exclusion_permisos=1
  useEffect(() => {
    if (usuariosQ.data) {
      const preexcluidos = new Set(
        usuariosQ.data
          .filter((u) => u.exclusion_permisos === 1)
          .map((u) => u.iduser),
      );
      setExcluidos(preexcluidos);
    }
  }, [usuariosQ.data]);

  const toggleUsuario = (iduser: string) => {
    setExcluidos((prev) => {
      const next = new Set(prev);
      if (next.has(iduser)) next.delete(iduser);
      else next.add(iduser);
      return next;
    });
  };

  const seleccionarTodos = () => setExcluidos(new Set());
  const deseleccionarTodos = () => setExcluidos(new Set(usuarios.map((u) => u.iduser)));

  const propagarM = useMutation({
    mutationFn: () => RolesAPI.propagar(idperfil, Array.from(excluidos)),
    onSuccess: (data) => {
      const errs: { iduser: string; mensaje: string }[] = data.errores ?? [];
      const sinDoc: { iduser: string }[] = data.sin_documento ?? [];
      if (data.propagados === 0 && data.excluidos === 0 && errs.length === 0) {
        toast('No hay usuarios activos en este rol', { icon: 'ℹ️' });
      } else {
        const partes: string[] = [];
        if (data.propagados > 0) partes.push(`${data.propagados} actualizados`);
        if (data.excluidos > 0) partes.push(`${data.excluidos} excluidos`);
        if (sinDoc.length > 0) partes.push(`${sinDoc.length} sin documento`);
        if (errs.length > 0) partes.push(`${errs.length} con error`);
        errs.length > 0 ? toast.error(partes.join(' · ')) : toast.success(partes.join(' · '));
      }
      if (errs.length > 0 || sinDoc.length > 0) {
        setErroresProp(errs);
        setSinDocProp(sinDoc);
        return;
      }
      onSuccess?.();
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || 'Error al propagar permisos');
    },
  });

  const propagados = usuarios.length - excluidos.size;
  const hayPersonalizados = usuarios.some((u) => u.exclusion_permisos === 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col rounded-xl bg-white shadow-xl dark:bg-zinc-900" style={{ maxHeight: '90vh' }}>

        {/* Header — fijo */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Propagar — <span className="text-brand-600">{rolNombre}</span>
            </h3>
          </div>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Los permisos del rol se copiarán a los usuarios marcados. Los desmarcados conservarán sus permisos y quedarán como <em>personalizados</em>.
          </p>

          {hayPersonalizados && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>Usuarios con <Sliders className="inline h-3 w-3" /> tienen permisos personalizados. Marcándolos se reintegran al rol.</span>
            </div>
          )}

          {/* Lista de usuarios */}
          {usuariosQ.isLoading ? (
            <div className="flex items-center justify-center py-6 text-zinc-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando…</span>
            </div>
          ) : usuarios.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">No hay usuarios activos en este rol.</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} en el rol</span>
                <div className="flex items-center gap-2">
                  <button onClick={seleccionarTodos} className="text-brand-600 hover:underline dark:text-brand-400">Todos</button>
                  <span className="text-zinc-300 dark:text-zinc-600">|</span>
                  <button onClick={deseleccionarTodos} className="text-zinc-500 hover:underline">Ninguno</button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800">
                {usuarios.map((u) => {
                  const incluido = !excluidos.has(u.iduser);
                  return (
                    <label key={u.iduser} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                      <input type="checkbox" checked={incluido} onChange={() => toggleUsuario(u.iduser)}
                        className="h-3.5 w-3.5 rounded accent-brand-600" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-xs font-medium text-zinc-800 dark:text-zinc-100">
                          {u.iduser}
                          {u.exclusion_permisos === 1 && (
                            <Sliders className="h-3 w-3 text-amber-500" title="Permisos personalizados" />
                          )}
                        </div>
                        <div className="truncate text-[10px] text-zinc-400">{u.nombre} {u.apellido}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                        incluido
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {incluido ? 'Actualizar' : 'Excluir'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {/* Panel: sin documento */}
          {sinDocProp.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/20">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {sinDocProp.length} usuario{sinDocProp.length !== 1 ? 's' : ''} sin documento — menus/permisos copiados, pero no se pudo unificar con el rol
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {sinDocProp.map((e) => (
                  <li key={e.iduser} className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    {e.iduser}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                Cargá el número de documento en cada uno y volvé a propagar para completar la unificación.
              </p>
            </div>
          )}

          {/* Panel: errores inesperados */}
          {erroresProp.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-800/40 dark:bg-rose-900/20">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                {erroresProp.length} usuario{erroresProp.length !== 1 ? 's' : ''} no pudieron actualizarse
              </div>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-[10px] text-rose-800 dark:text-rose-300">
                {erroresProp.map((e) => (
                  <li key={e.iduser} className="flex gap-2">
                    <span className="shrink-0 font-mono font-semibold">{e.iduser}</span>
                    <span className="text-rose-600 dark:text-rose-400">{e.mensaje}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer — fijo */}
        <div className="flex shrink-0 items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {propagados > 0
              ? <><strong className="text-zinc-700 dark:text-zinc-300">{propagados}</strong> recibirán los permisos</>
              : 'Ningún usuario recibirá los permisos'
            }
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost text-sm" disabled={propagarM.isPending}>Cancelar</button>
            <button
              onClick={() => propagarM.mutate()}
              className="btn-primary text-sm"
              disabled={propagarM.isPending || usuarios.length === 0}
            >
              {propagarM.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Propagando…</>
                : 'Aplicar'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
