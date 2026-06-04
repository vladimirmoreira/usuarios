import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  ColumnDef,
  SortingState,
  flexRender,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Printer, FileDown } from 'lucide-react';
import { AuditoriaAPI, AuditoriaParams, HistorialRow } from '../../api/endpoints';

// ── Helpers de exportación ────────────────────────────────────────────────────
function escapeCSV(val: unknown): string {
  if (val == null) return '';
  const s = String(val).replace(/"/g, '""');
  return /[,"\n\r]/.test(s) ? `"${s}"` : s;
}

function downloadCSV(rows: HistorialRow[], filename: string) {
  const header = ['ID', 'Fecha', 'Usuario', 'Operación', 'Autorización', 'Observación'];
  const lines  = rows.map((r) =>
    [r.id, r.fecha?.slice(0, 10), r.usuario, r.descripcion ?? r.idoperacion, r.autorizacion, r.observacion]
      .map(escapeCSV)
      .join(','),
  );
  const blob = new Blob(['\uFEFF' + [header.join(','), ...lines].join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Operaciones disponibles ──────────────────────────────────────────────────
const OPERACIONES_LISTA = [
  { id: 1,  descripcion: 'Alta de Usuario' },
  { id: 2,  descripcion: 'Baja de Usuario' },
  { id: 3,  descripcion: 'Reset de Clave' },
  { id: 4,  descripcion: 'Eliminar Huella' },
  { id: 5,  descripcion: 'Reasignar Sucursal' },
  { id: 6,  descripcion: 'Cambio de Perfil' },
  { id: 7,  descripcion: 'Actualizar Cuenta' },
  { id: 8,  descripcion: 'Vincular Legajo' },
  { id: 9,  descripcion: 'Excluir Cuenta' },
  { id: 10, descripcion: 'Migrar Datos' },
  { id: 11, descripcion: 'Reactivar' },
  { id: 12, descripcion: 'Login' },
  { id: 13, descripcion: 'Login Fallido' },
];

const OP_COLORS: Record<number, string> = {
  1:  'bg-green-100 text-green-800',
  2:  'bg-red-100 text-red-800',
  3:  'bg-yellow-100 text-yellow-800',
  4:  'bg-orange-100 text-orange-800',
  5:  'bg-blue-100 text-blue-800',
  6:  'bg-purple-100 text-purple-800',
  7:  'bg-indigo-100 text-indigo-800',
  8:  'bg-teal-100 text-teal-800',
  9:  'bg-rose-100 text-rose-800',
  10: 'bg-cyan-100 text-cyan-800',
  11: 'bg-emerald-100 text-emerald-800',
  12: 'bg-slate-100 text-slate-700',
  13: 'bg-red-200 text-red-900',
};

// ── Columnas ─────────────────────────────────────────────────────────────────
const COLUMNS: ColumnDef<HistorialRow>[] = [
  {
    accessorKey: 'id',
    header: '#',
    size: 70,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-gray-500">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: 'fecha',
    header: 'Fecha',
    size: 100,
    cell: ({ getValue }) => {
      const raw = getValue<string>();
      if (!raw) return '—';
      // Firebird devuelve ISO string; tomar solo YYYY-MM-DD
      return raw.slice(0, 10);
    },
  },
  {
    accessorKey: 'usuario',
    header: 'Usuario',
    size: 110,
    cell: ({ getValue }) => (
      <span className="font-mono font-semibold text-sm">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'descripcion',
    header: 'Operación',
    size: 180,
    cell: ({ row }) => {
      const op   = row.original.idoperacion;
      const desc = row.original.descripcion ?? `OP ${op}`;
      return (
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
            OP_COLORS[op] ?? 'bg-gray-100 text-gray-700'
          }`}
        >
          {desc}
        </span>
      );
    },
  },
  {
    accessorKey: 'autorizacion',
    header: 'Autorización',
    size: 120,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue<string>() || '—'}</span>
    ),
  },
  {
    accessorKey: 'observacion',
    header: 'Observación',
    enableSorting: false,
    cell: ({ getValue }) => {
      const val = getValue<string | null>();
      if (!val) return <span className="text-gray-400 text-xs">—</span>;
      return (
        <span className="text-xs text-gray-700 whitespace-pre-wrap break-words max-w-xs block">
          {val}
        </span>
      );
    },
  },
];

// ── Componente de ícono de orden ──────────────────────────────────────────────
function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc')  return <ChevronUp   className="w-3.5 h-3.5 text-blue-600" />;
  if (sorted === 'desc') return <ChevronDown className="w-3.5 h-3.5 text-blue-600" />;
  return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400" />;
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AuditoriaPage() {
  // Filtros en edición (no disparan query mientras no se aplican)
  const [draft, setDraft] = useState({ usuario: '', idoperacion: '' as number | '', autorizacion: '', desde: '', hasta: '' });
  // Filtros activos que alimentan la query
  const [filters, setFilters] = useState<AuditoriaParams>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'id', desc: true }]);

  const aplicar = useCallback(() => {
    setPage(1);
    setFilters({
      usuario:      draft.usuario.trim() || undefined,
      idoperacion:  draft.idoperacion !== '' ? draft.idoperacion : undefined,
      autorizacion: draft.autorizacion.trim() || undefined,
      desde:        draft.desde || undefined,
      hasta:        draft.hasta || undefined,
    });
  }, [draft]);

  const limpiar = useCallback(() => {
    setDraft({ usuario: '', idoperacion: '', autorizacion: '', desde: '', hasta: '' });
    setFilters({});
    setPage(1);
  }, []);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['auditoria', filters, page, pageSize],
    queryFn: () => AuditoriaAPI.listar({ ...filters, page, pageSize }),
    placeholderData: (prev) => prev,
  });

  const table = useReactTable({
    data: data?.rows ?? [],
    columns: COLUMNS,
    state:   { sorting },
    onSortingChange: setSorting,
    getCoreRowModel:   getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  const totalPages = data?.totalPages ?? 1;
  const total      = data?.total ?? 0;

  // Exporta sólo la página actual visible
  const exportarPaginaCSV = useCallback(() => {
    const rows = table.getRowModel().rows.map((r) => r.original);
    if (!rows.length) return;
    downloadCSV(rows, `auditoria_pag${page}.csv`);
  }, [table, page]);

  // Exporta TODOS los registros (nueva petición sin paginación)
  const [exportando, setExportando] = useState(false);
  const exportarTodoCSV = useCallback(async () => {
    setExportando(true);
    try {
      const res = await AuditoriaAPI.listar({ ...filters, page: 1, pageSize: 5000 });
      downloadCSV(res.rows, 'auditoria_completo.csv');
    } finally {
      setExportando(false);
    }
  }, [filters]);

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-zinc-100">Auditoría</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Historial de operaciones sobre usuarios</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm px-3 py-1.5 rounded transition-colors dark:border-zinc-600 dark:hover:bg-zinc-700 dark:text-zinc-200"
            title="Imprimir / Guardar como PDF"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button
            onClick={exportarPaginaCSV}
            disabled={!data?.rows.length}
            className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm px-3 py-1.5 rounded transition-colors disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-700 dark:text-zinc-200"
            title="Exportar página actual a CSV/Excel"
          >
            <FileDown className="w-4 h-4" /> CSV (página)
          </button>
          <button
            onClick={exportarTodoCSV}
            disabled={exportando || !total}
            className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-40"
            title="Exportar todos los registros filtrados a CSV/Excel (máx. 5000)"
          >
            <FileDown className="w-4 h-4" />
            {exportando ? 'Exportando…' : 'CSV (todos)'}
          </button>
        </div>
      </div>

      {/* Panel de filtros */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm dark:bg-zinc-800 dark:border-zinc-700">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Usuario */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Usuario</label>
            <input
              type="text"
              placeholder="Ej: JPEREZ"
              value={draft.usuario}
              onChange={(e) => setDraft((d) => ({ ...d, usuario: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && aplicar()}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500"
            />
          </div>

          {/* Operación */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Operación</label>
            <select
              value={draft.idoperacion}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  idoperacion: e.target.value === '' ? '' : Number(e.target.value),
                }))
              }
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
            >
              <option value="">Todas</option>
              {OPERACIONES_LISTA.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.descripcion}
                </option>
              ))}
            </select>
          </div>

          {/* Autorización */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Autorización</label>
            <input
              type="text"
              placeholder="Ej: ADMIN"
              value={draft.autorizacion}
              onChange={(e) => setDraft((d) => ({ ...d, autorizacion: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && aplicar()}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500"
            />
          </div>

          {/* Desde */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Desde</label>
            <input
              type="date"
              value={draft.desde}
              onChange={(e) => setDraft((d) => ({ ...d, desde: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
            />
          </div>

          {/* Hasta */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Hasta</label>
            <input
              type="date"
              value={draft.hasta}
              onChange={(e) => setDraft((d) => ({ ...d, hasta: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
            />
          </div>
        </div>

        {/* Botones */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={aplicar}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded font-medium transition-colors"
          >
            Buscar
          </button>
          <button
            onClick={limpiar}
            className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm px-4 py-1.5 rounded transition-colors dark:border-zinc-600 dark:hover:bg-zinc-700 dark:text-zinc-200"
          >
            Limpiar
          </button>
          {isFetching && (
            <span className="text-xs text-gray-400 animate-pulse ml-2 dark:text-zinc-500">Cargando…</span>
          )}
          {total > 0 && !isFetching && (
            <span className="text-xs text-gray-500 ml-auto dark:text-zinc-400">
              {total.toLocaleString()} registro{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-zinc-900 dark:border-zinc-700">
        {isError ? (
          <div className="flex items-center justify-center h-40 text-sm text-red-500">
            Error al cargar el historial.
          </div>
        ) : (
          <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-zinc-700">
            <thead className="bg-gray-50 sticky top-0 z-10 dark:bg-zinc-800">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap dark:text-zinc-300"
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          disabled={!header.column.getCanSort()}
                          className="inline-flex items-center gap-1 hover:text-gray-900 disabled:cursor-default"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <SortIcon sorted={header.column.getIsSorted()} />
                          )}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-700/60">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="text-center py-12 text-gray-400 text-sm">
                    {isFetching ? 'Cargando registros…' : 'Sin registros para los filtros seleccionados.'}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800/50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 dark:text-zinc-400">Filas por página:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-2 py-1 rounded border border-gray-300 text-xs disabled:opacity-40 hover:bg-gray-50 dark:border-zinc-600 dark:hover:bg-zinc-700 dark:text-zinc-300"
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:border-zinc-600 dark:hover:bg-zinc-700 dark:text-zinc-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 text-sm text-gray-700 dark:text-zinc-300">
            Pág. <strong>{page}</strong> de <strong>{totalPages}</strong>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:border-zinc-600 dark:hover:bg-zinc-700 dark:text-zinc-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className="px-2 py-1 rounded border border-gray-300 text-xs disabled:opacity-40 hover:bg-gray-50 dark:border-zinc-600 dark:hover:bg-zinc-700 dark:text-zinc-300"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
