import { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type FilterFn,
} from '@tanstack/react-table';
import {
  AlertTriangle, ChevronUp, ChevronDown, ChevronsUpDown,
  Pencil, KeyRound, Power, ChevronLeft, ChevronRight, ShieldCheck, Database, History, Sliders, MapPin, Link2,
} from 'lucide-react';
import type { Usuario } from '../../api/endpoints';

type Props = {
  data:      Usuario[];
  perfiles:  Record<number, string>;
  perfilesMaster?: Set<number>;
  selectedId?: string | null;
  onSelect?: (iduser: string) => void;
  onEditar:  (u: Usuario) => void;
  onReset:   (iduser: string) => void;
  onBaja:      (iduser: string) => void;
  onReactivar: (iduser: string) => void;
  onVincularLegajo?: (iduser: string) => void;
  /** Flag de la BD configuracion_usuario para la IP actual */
  gastronomia?: boolean;
  onHistorial?: (iduser: string) => void;
  onSucursal?:  (u: Usuario) => void;
  /** Modo selección múltiple activo (filtra solo activos + muestra checkboxes) */
  multiSelect?: boolean;
  selectedIds?: Set<string>;
  onToggleSelected?: (iduser: string) => void;
  onToggleAllSelected?: (ids: string[]) => void;
};

const ESTADO_OPTS = ['Activo', 'Bloqueado', 'Inactivo'];

// Filtro especial: muestra solo filas donde documento está vacío
const sinDocumentoFn: FilterFn<any> = (row) => {
  const doc = row.getValue<string>('documento');
  return !doc || !doc.trim();
};
sinDocumentoFn.autoRemove = (val: any) => !val;

export default function UsuariosDataGrid({ data, perfiles, perfilesMaster, selectedId, onSelect, onEditar, onReset, onBaja, onReactivar, onVincularLegajo, gastronomia, onHistorial, onSucursal, multiSelect, selectedIds, onToggleSelected, onToggleAllSelected }: Props) {
  const [sorting, setSorting]             = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnOrder, setColumnOrder]     = useState<string[]>([]);
  const [pagination, setPagination]       = useState({ pageIndex: 0, pageSize: 20 });
  const [badgeFilter, setBadgeFilter]     = useState<string | null>(null);
  const dragCol = useRef<string | null>(null);

  const filteredData = useMemo(() => {
    let base = data;
    // Modo selección múltiple: solo activos
    if (multiSelect) base = base.filter((u) => u.estado === 1);
    if (!badgeFilter) return base;
    if (badgeFilter === 'sin_menu')  return base.filter((u) => u.sin_menu === 1);
    if (badgeFilter === 'sin_doc')   return base.filter((u) => !u.documento?.trim());
    if (badgeFilter === 'master')    return base.filter((u) => perfilesMaster?.has(u.idtipo_usuario));
    if (badgeFilter === 'exclusion') return base.filter((u) => u.exclusion_permisos === 1);
    return base;
  }, [data, badgeFilter, perfilesMaster, multiSelect]);

  const toggleBadge = (key: string) => {
    setBadgeFilter((prev) => (prev === key ? null : key));
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const perfilOpts = useMemo(() => Object.values(perfiles).sort(), [perfiles]);
  const sucursalOpts = useMemo(() => {
    const set = new Set<string>();
    for (const u of data) {
      const s = u.sucursal_nombre?.trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const columns = useMemo<ColumnDef<Usuario>[]>(() => {
    const cols: ColumnDef<Usuario>[] = [];
    if (multiSelect) {
      cols.push({
        id: '__select',
        header: () => {
          const visibles = filteredData.map((u) => u.iduser);
          const allChecked = visibles.length > 0 && visibles.every((id) => selectedIds?.has(id));
          return (
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => onToggleAllSelected?.(visibles)}
              onClick={(e) => e.stopPropagation()}
              className="h-3.5 w-3.5 cursor-pointer accent-brand-600"
              title={allChecked ? 'Deseleccionar todos' : 'Seleccionar todos'}
            />
          );
        },
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row: { original: u } }) => (
          <input
            type="checkbox"
            checked={selectedIds?.has(u.iduser) ?? false}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggleSelected?.(u.iduser)}
            className="h-3.5 w-3.5 cursor-pointer accent-brand-600"
          />
        ),
      });
    }
    cols.push(
      {
      id: 'iduser', accessorKey: 'iduser', header: 'Usuario',
      cell: ({ row: { original: u } }) => (
        <div className="flex items-center gap-1.5 font-medium">
          {u.iduser}
          {perfilesMaster?.has(u.idtipo_usuario) && (
            <Database className="h-3 w-3 text-violet-600"
              aria-label="Replica a BD Master (Contabilidad / RRHH)" />
          )}
          {u.sin_menu === 1 && (
            <AlertTriangle className="h-3 w-3 cursor-pointer text-amber-400"
              aria-label="Sin menús configurados" onClick={() => onEditar(u)} />
          )}
          {!u.documento?.trim() && (
            <AlertTriangle className="h-3 w-3 cursor-pointer text-blue-400"
              aria-label="Sin documento registrado" onClick={() => onEditar(u)} />
          )}
          {u.exclusion_permisos === 1 && (
            <Sliders
              className="h-3 w-3 text-amber-500"
              aria-label="Permisos personalizados (excluido de última propagación del rol)"
            />
          )}
        </div>
      ),
    },
    { id: 'nombre',    accessorKey: 'nombre',   header: 'Nombre' },
    { id: 'apellido',  accessorKey: 'apellido',  header: 'Apellido' },
    {
      id: 'sucursal', header: 'Sucursal',
      accessorFn: (row) => row.sucursal_nombre ?? '',
      filterFn: 'equalsString',
    },
    { id: 'documento', accessorKey: 'documento', header: 'Documento',
      filterFn: (row, columnId, filterValue) => {
        // Si el filtro es el centinela '__sin_doc__' usamos la lógica especial
        if (filterValue === '__sin_doc__') return sinDocumentoFn(row, columnId, filterValue, () => {});
        const val = (row.getValue(columnId) as string) ?? '';
        return val.toLowerCase().includes(String(filterValue).toLowerCase());
      },
    },
    {
      id: 'perfil', header: 'Perfil',
      accessorFn: (row) => perfiles[row.idtipo_usuario] ?? '',
      filterFn: 'equalsString',
    },
    {
      id: 'estado', header: 'Estado',
      accessorFn: (row) => row.estado === 1 ? 'Activo' : row.estado === 2 ? 'Bloqueado' : 'Inactivo',
      filterFn: 'equalsString',
      cell: ({ row: { original: u } }) => {
        const cls = u.estado === 1 ? 'bg-emerald-50 text-emerald-700'
          : u.estado === 2 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
            {u.estado === 1 ? 'Activo' : u.estado === 2 ? 'Bloqueado' : 'Inactivo'}
          </span>
        );
      },
    },
    {
      id: 'acciones', header: '', enableSorting: false, enableColumnFilter: false,
      cell: ({ row: { original: u } }) => {
        if (multiSelect) return null;
        const inactivo = u.estado !== 1 && u.estado !== 2;
        const dis = 'opacity-30 pointer-events-none';
        return (
          <div className="flex justify-end gap-0.5">
            <Link
              to={`/usuarios/${u.iduser}/accesos`}
              className={`btn-ghost p-1 ${inactivo ? dis : ''}`}
              title="Accesos"
              onClick={() => !inactivo && onSelect?.(u.iduser)}
              tabIndex={inactivo ? -1 : undefined}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            </Link>
            <button disabled={inactivo} className={`btn-ghost p-1 ${inactivo ? dis : ''}`} title="Modificar" onClick={() => { onSelect?.(u.iduser); onEditar(u); }}>
              <Pencil className="h-3.5 w-3.5 text-brand-600" />
            </button>
            <button disabled={inactivo} className={`btn-ghost p-1 ${inactivo ? dis : ''}`} title="Reiniciar clave" onClick={() => { onSelect?.(u.iduser); onReset(u.iduser); }}>
              <KeyRound className="h-3.5 w-3.5" />
            </button>
            {onHistorial && (
              <button disabled={inactivo} className={`btn-ghost p-1 ${inactivo ? dis : ''}`} title="Historial" onClick={() => { onSelect?.(u.iduser); onHistorial(u.iduser); }}>
                <History className="h-3.5 w-3.5 text-indigo-600" />
              </button>
            )}
            {onSucursal && (
              <button disabled={inactivo} className={`btn-ghost p-1 ${inactivo ? dis : ''}`} title="Sucursal" onClick={() => { onSelect?.(u.iduser); onSucursal(u); }}>
                <MapPin className="h-3.5 w-3.5 text-teal-600" />
              </button>
            )}
            {gastronomia && onVincularLegajo && !inactivo && (
              <button className="btn-ghost p-1" title="Vincular a Legajo (RH/Mesero)" onClick={() => { onSelect?.(u.iduser); onVincularLegajo(u.iduser); }}>
                <Link2 className="h-3.5 w-3.5 text-fuchsia-600" />
              </button>
            )}
            {inactivo ? (
              <button className="btn-ghost p-1" title="Reactivar" onClick={() => { onSelect?.(u.iduser); onReactivar(u.iduser); }}>
                <Power className="h-3.5 w-3.5 text-emerald-600" />
              </button>
            ) : (
              <button className="btn-ghost p-1" title="Dar de baja" onClick={() => { onSelect?.(u.iduser); onBaja(u.iduser); }}>
                <Power className="h-3.5 w-3.5 text-rose-600" />
              </button>
            )}
          </div>
        );
      },
    },
    );
    return cols;
  }, [perfiles, perfilOpts, perfilesMaster, onEditar, onReset, onBaja, onReactivar, onVincularLegajo, gastronomia, onSelect, onHistorial, onSucursal, multiSelect, selectedIds, onToggleSelected, onToggleAllSelected, filteredData]);

  const table = useReactTable({
    data: filteredData, columns,
    state: { sorting, columnFilters, columnOrder, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleDrop = (targetId: string) => {
    if (!dragCol.current || dragCol.current === targetId) return;
    const cur = table.getAllLeafColumns().map((c) => c.id);
    const from = cur.indexOf(dragCol.current);
    const to   = cur.indexOf(targetId);
    const next = [...cur];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setColumnOrder(next);
    dragCol.current = null;
  };

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();

  const selectCls = 'mt-1 w-full rounded border border-zinc-200 bg-white px-1 py-0.5 text-[10px] font-normal normal-case tracking-normal text-zinc-700 focus:border-brand-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200';
  const inputCls  = 'mt-1 w-full rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal text-zinc-700 placeholder-zinc-300 focus:border-brand-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500';

  return (
    <div className="card overflow-hidden">

      {/* Toolbar superior */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
        <span className="text-zinc-400">{totalRows} registro{totalRows !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-2">
          <span>Filas:</span>
          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
          >
            {[20, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Leyenda de badges / filtros rápidos */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[10px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
        <span className="font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Referencias:</span>
        {([
          { key: 'sin_menu',  icon: <AlertTriangle className="h-3 w-3 text-amber-400" />,  label: 'Sin menús configurados',  active: 'border-amber-400 bg-amber-50 text-amber-700' },
          { key: 'sin_doc',   icon: <AlertTriangle className="h-3 w-3 text-blue-400" />,   label: 'Sin documento registrado', active: 'border-blue-400 bg-blue-50 text-blue-700' },
          { key: 'master',    icon: <Database className="h-3 w-3 text-violet-600" />,      label: 'Replica a BD Master',      active: 'border-violet-400 bg-violet-50 text-violet-700' },
          { key: 'exclusion', icon: <Sliders className="h-3 w-3 text-amber-500" />,        label: 'Permisos personalizados',  active: 'border-amber-500 bg-amber-50 text-amber-700' },
        ] as const).map(({ key, icon, label, active }) => (
          <button
            key={key}
            onClick={() => toggleBadge(key)}
            title={`Filtrar: ${label}`}
            className={`flex items-center gap-1 rounded border px-1.5 py-0.5 transition ${
              badgeFilter === key
                ? `${active} font-semibold`
                : 'border-transparent hover:border-zinc-300 hover:text-zinc-700'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-left text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-300">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const isActions = header.column.id === 'acciones';
                  const isSelect  = header.column.id === '__select';
                  const isFixed   = isActions || isSelect;
                  const canSort   = header.column.getCanSort();
                  const canFilter = header.column.getCanFilter();
                  const sorted    = header.column.getIsSorted();
                  const colId     = header.column.id;
                  const filterVal = (header.column.getFilterValue() ?? '') as string;

                  return (
                    <th
                      key={header.id}
                      draggable={!isFixed}
                      onDragStart={() => { dragCol.current = header.column.id; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(header.column.id)}
                      className={`px-3 py-2 select-none ${isActions ? 'text-right' : ''} ${isFixed ? '' : 'cursor-grab active:cursor-grabbing'} ${isSelect ? 'w-8 text-center' : ''}`}
                    >
                      <div
                        className={`flex items-center gap-1 ${isActions ? 'justify-end' : ''} ${canSort ? 'cursor-pointer' : ''}`}
                        onClick={canSort ? (header.column.getToggleSortingHandler() ?? undefined) : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="text-zinc-400">
                            {sorted === 'asc'  ? <ChevronUp className="h-3 w-3" /> :
                             sorted === 'desc' ? <ChevronDown className="h-3 w-3" /> :
                                                 <ChevronsUpDown className="h-3 w-3" />}
                          </span>
                        )}
                      </div>

                      {canFilter && colId === 'perfil' && (
                        <select value={filterVal}
                          onChange={(e) => header.column.setFilterValue(e.target.value || undefined)}
                          onClick={(e) => e.stopPropagation()} className={selectCls}>
                          <option value="">Todos</option>
                          {perfilOpts.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      )}
                      {canFilter && colId === 'sucursal' && (
                        <select value={filterVal}
                          onChange={(e) => header.column.setFilterValue(e.target.value || undefined)}
                          onClick={(e) => e.stopPropagation()} className={selectCls}>
                          <option value="">Todas</option>
                          {sucursalOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {canFilter && colId === 'estado' && (
                        <select value={filterVal}
                          onChange={(e) => header.column.setFilterValue(e.target.value || undefined)}
                          onClick={(e) => e.stopPropagation()} className={selectCls}>
                          <option value="">Todos</option>
                          {ESTADO_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                      {canFilter && colId !== 'perfil' && colId !== 'estado' && colId !== 'sucursal' && (
                        colId === 'documento' && filterVal === '__sin_doc__'
                          ? <span className="mt-1 block text-[10px] italic text-blue-500">Sin documento ×</span>
                          : <input value={filterVal === '__sin_doc__' ? '' : filterVal}
                              onChange={(e) => header.column.setFilterValue(e.target.value || undefined)}
                              placeholder="Filtrar..." onClick={(e) => e.stopPropagation()}
                              className={inputCls} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isSelected = selectedId === row.original.iduser;
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelect?.(row.original.iduser)}
                  className={`cursor-pointer border-t border-zinc-100 dark:border-zinc-700/60 ${
                    isSelected
                      ? 'bg-brand-100 hover:bg-brand-200 dark:bg-brand-900/30 dark:hover:bg-brand-900/50'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}
                      className={`px-3 py-1.5 ${cell.column.id === 'acciones' ? 'text-right' : ''} ${cell.column.id === '__select' ? 'w-8 text-center' : ''}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-zinc-400">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginador inferior */}
      <div className="flex items-center justify-end gap-1 border-t border-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
        <button className="btn-ghost p-1 disabled:opacity-30" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-1 tabular-nums">
          {pageCount === 0 ? '0 / 0' : `${pageIndex + 1} / ${pageCount}`}
        </span>
        <button className="btn-ghost p-1 disabled:opacity-30" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
}
