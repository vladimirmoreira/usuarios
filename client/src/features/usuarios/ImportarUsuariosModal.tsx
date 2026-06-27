'use client';
import { useRef, useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X, AlertTriangle, CheckCircle, Download, FileText } from 'lucide-react';
import toast from '../../lib/notify';
import {
  UsuariosAPI,
  type FilaImportacion,
  type FilaImportada,
  type ErrorImportacion,
} from '../../api/endpoints';

interface Props { onClose: () => void; onImportado?: () => void; }

/* ─── CSV parser ──────────────────────────────────────────────────────────── */
const COLS = ['nombre', 'apellido', 'documento', 'perfil', 'idsucursal'] as const;
type ColKey = typeof COLS[number];

function parseCsv(texto: string): FilaImportacion[] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return [];

  // Detectar separador: '\t' (Excel), ';' o ','
  const sep = lineas[0].includes('\t') ? '\t' : lineas[0].includes(';') ? ';' : ',';

  // Detectar si la primera fila es cabecera
  const primera = lineas[0].split(sep).map((c) => c.trim().toLowerCase().replace(/["\s]/g, ''));
  const tieneHeader = COLS.some((c) => primera.includes(c));

  let colIndex: Record<ColKey, number>;
  let inicio: number;

  if (tieneHeader) {
    colIndex = {
      nombre:     primera.indexOf('nombre'),
      apellido:   primera.indexOf('apellido'),
      documento:  primera.indexOf('documento'),
      perfil:     primera.indexOf('perfil'),
      idsucursal: primera.indexOf('idsucursal'),
    };
    inicio = 1;
  } else {
    // Posicional: col0=nombre, col1=apellido, col2=documento, col3=perfil, col4=idsucursal
    colIndex = { nombre: 0, apellido: 1, documento: 2, perfil: 3, idsucursal: 4 };
    inicio = 0;
  }

  const filas: FilaImportacion[] = [];
  for (let i = inicio; i < lineas.length; i++) {
    const celdas = lineas[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (celdas.every((c) => !c)) continue;
    const get = (k: ColKey) => colIndex[k] >= 0 ? (celdas[colIndex[k]] ?? '') : '';
    filas.push({
      nombre:     get('nombre'),
      apellido:   get('apellido'),
      documento:  get('documento'),
      perfil:     get('perfil'),
      idsucursal: get('idsucursal'),
    });
  }
  return filas;
}

/* ─── Exportar resultado ──────────────────────────────────────────────────── */
function exportarResultado(importados: FilaImportada[]) {
  const headers = ['iduser', 'nombre', 'apellido', 'documento', 'perfil', 'idsucursal'];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [
    headers.join(';'),
    ...importados.map((r) =>
      [r.iduser, r.nombre, r.apellido, r.documento, r.perfil, r.idsucursal].map(esc).join(';'),
    ),
  ];
  const blob = new Blob(['\uFEFF' + lineas.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url; a.download = `importados_${stamp}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─── Componente ──────────────────────────────────────────────────────────── */
type Paso = 'preview' | 'resultado';

export default function ImportarUsuariosModal({ onClose }: Props) {
  const qc          = useQueryClient();
  const inputRef    = useRef<HTMLInputElement>(null);
  const [paso, setPaso]             = useState<Paso>('preview');
  const [filas, setFilas]           = useState<FilaImportacion[]>([]);
  const [archivoNombre, setNombre]  = useState('');
  const [importados, setImportados] = useState<FilaImportada[]>([]);
  const [errores, setErrores]       = useState<ErrorImportacion[]>([]);
  const [errExec, setErrExec]       = useState<{ fila: number; iduser: string; mensaje: string }[]>([]);
  const [archivoErr, setArchivoErr] = useState<string | null>(null);
  const [errWriteTxt, setErrWriteTxt] = useState<string | null>(null);

  /** Pre-validación cliente: duplicados de documento + campos requeridos vacíos. */
  const rowIssues = useMemo<string[][]>(() => {
    if (!filas.length) return [];
    const docMap = new Map<string, number[]>();
    filas.forEach((f, i) => {
      const doc = String(f.documento).trim();
      if (doc) {
        if (!docMap.has(doc)) docMap.set(doc, []);
        docMap.get(doc)!.push(i);
      }
    });
    return filas.map((f, i) => {
      const issues: string[] = [];
      if (!f.nombre.trim())             issues.push('nombre vacío');
      if (!f.apellido.trim())           issues.push('apellido vacío');
      const doc = String(f.documento).trim();
      if (!doc) {
        issues.push('documento vacío');
      } else if ((docMap.get(doc)?.length ?? 0) > 1) {
        issues.push(`documento «${doc}» repetido`);
      }
      if (!String(f.perfil).trim())     issues.push('perfil vacío');
      if (!String(f.idsucursal).trim()) issues.push('sucursal vacía');
      return issues;
    });
  }, [filas]);

  const filasConProblemas = rowIssues.filter((r) => r.length > 0).length;

  const leerArchivo = (file: File) => {
    setNombre(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const texto = e.target?.result as string;
      const parsed = parseCsv(texto);
      setFilas(parsed);
      setPaso('preview');
      setImportados([]); setErrores([]); setErrExec([]); setArchivoErr(null); setErrWriteTxt(null);
    };
    reader.readAsText(file, 'utf-8');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) leerArchivo(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) leerArchivo(file);
  };

  const importarM = useMutation({
    mutationFn: () => UsuariosAPI.importar(filas),
    onSuccess: (data) => {
      if (!data.ok) {
        setErrores(data.errores ?? []);
        setArchivoErr(data.archivoErrores ?? null);
        setPaso('resultado');
        toast.error(`${data.errores?.length} error/es encontrados. Revise el archivo TXT.`);
      } else {
        const imp  = data.importados?.length ?? 0;
        const exec = data.erroresEjecucion?.length ?? 0;
        setImportados(data.importados ?? []);
        setErrExec(data.erroresEjecucion ?? []);
        setPaso('resultado');
        qc.invalidateQueries({ queryKey: ['usuarios'] });
        if (imp > 0 && exec === 0) {
          toast.success(`${imp} usuario/s importado/s correctamente`);
        } else if (imp > 0) {
          toast(`${imp} importado/s · ${exec} con error de ejecución`, { icon: '⚠️' });
        } else {
          toast.error(`Todos los registros fallaron en ejecución. Verificá la configuración de perfiles.`);
        }
      }
    },
    onError: (e: any) => {
      const data = e?.response?.data;
      if (data?.errores) {
        // 422 con lista de errores de validación
        setErrores(data.errores ?? []);
        setArchivoErr(data.archivoErrores ?? null);
        setErrWriteTxt(data.errorEscrituraArchivo ?? null);
        setPaso('resultado');
        toast.error(`${data.errores?.length} fila/s con errores de validación`);
      } else {
        toast.error(data?.error || 'Error al importar');
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-zinc-500" />
            <h3 className="text-base font-semibold text-zinc-800">Importar Usuarios</h3>
            {archivoNombre && (
              <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">{archivoNombre}</span>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost"><X className="h-4 w-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Zona drop / selección de archivo — siempre visible */}
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 py-6 text-sm text-zinc-500 transition-colors hover:border-brand-500 hover:bg-zinc-100"
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
          >
            <FileText className="h-8 w-8 text-zinc-300" />
            <p>Arrastrá un archivo CSV/TXT o <span className="text-brand-600 underline">hacé clic para seleccionar</span></p>
            <p className="text-xs text-zinc-400">Columnas requeridas: <code>nombre · apellido · documento · perfil · idsucursal</code></p>
            <p className="text-xs text-zinc-400">Separador: <code>TAB</code> (Excel) · <code>;</code> · <code>,</code> · Con o sin fila de cabecera · Máx. 200 filas</p>
          </div>
          <input ref={inputRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={onFileChange} />

          {/* ── PASO PREVIEW ── */}
          {paso === 'preview' && filas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-700">{filas.length}</span> fila/s detectadas
                  {filasConProblemas > 0 && (
                    <span className="ml-1 text-amber-600 font-medium">· {filasConProblemas} con problemas</span>
                  )}
                </p>
                {filasConProblemas === 0 && (
                  <span className="text-xs text-emerald-600 font-medium">✓ Sin problemas detectados</span>
                )}
              </div>

              {filasConProblemas > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>{filasConProblemas} fila/s</strong> tienen problemas detectados localmente (resaltadas en naranja). Corregí el archivo antes de importar.
                  </span>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Apellido</th>
                      <th className="px-3 py-2">Documento</th>
                      <th className="px-3 py-2">Perfil</th>
                      <th className="px-3 py-2">Suc.</th>
                      <th className="px-3 py-2">Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => {
                      const issues = rowIssues[i] ?? [];
                      const hasIssue = issues.length > 0;
                      return (
                        <tr
                          key={i}
                          className={`border-t ${
                            hasIssue
                              ? 'bg-amber-50 hover:bg-amber-100 border-amber-100'
                              : 'border-zinc-100 hover:bg-zinc-50'
                          }`}
                        >
                          <td className="px-3 py-1.5 text-zinc-400">{i + 1}</td>
                          <td className={`px-3 py-1.5 ${!f.nombre ? 'text-rose-400' : ''}`}>{f.nombre || '—'}</td>
                          <td className={`px-3 py-1.5 ${!f.apellido ? 'text-rose-400' : ''}`}>{f.apellido || '—'}</td>
                          <td className={`px-3 py-1.5 font-mono ${!f.documento ? 'text-rose-400' : ''}`}>{f.documento || '—'}</td>
                          <td className={`px-3 py-1.5 ${!f.perfil ? 'text-rose-400' : ''}`}>{f.perfil || '—'}</td>
                          <td className={`px-3 py-1.5 font-mono ${!f.idsucursal ? 'text-rose-400' : ''}`}>{f.idsucursal || '—'}</td>
                          <td className="px-3 py-1.5">
                            {hasIssue
                              ? <span className="text-amber-700">{issues.join(' · ')}</span>
                              : <span className="text-emerald-500">✓</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PASO RESULTADO: errores ── */}
          {paso === 'resultado' && errores.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-rose-700">{errores.length} fila/s con errores.</span>
                  {archivoErr && (
                    <span className="ml-1 text-rose-600">
                      Detalle guardado en: <code className="text-xs">{archivoErr}</code>
                    </span>
                  )}
                  {errWriteTxt && (
                    <span className="ml-1 text-rose-500 text-xs">
                      (No se pudo escribir el TXT: {errWriteTxt})
                    </span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-rose-100">
                <table className="w-full text-xs">
                  <thead className="bg-rose-50 text-left uppercase tracking-wide text-rose-400">
                    <tr>
                      <th className="px-3 py-2 w-10">Fila</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Documento</th>
                      <th className="px-3 py-2">Errores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errores.map((e, i) => (
                      <tr key={i} className="border-t border-rose-50">
                        <td className="px-3 py-1.5 text-slate-400">{e.fila}</td>
                        <td className="px-3 py-1.5">{e.nombre} {e.apellido}</td>
                        <td className="px-3 py-1.5 font-mono">{e.documento || '—'}</td>
                        <td className="px-3 py-1.5">
                          <ul className="list-none space-y-0.5">
                            {e.errores.map((msg, j) => (
                              <li key={j} className="text-rose-600">· {msg}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PASO RESULTADO: errores de ejecución (siempre visibles si existen) ── */}
          {paso === 'resultado' && errExec.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="text-sm font-medium text-rose-700">
                  {errExec.length} registro/s fallaron durante la ejecución
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-rose-100">
                <table className="w-full text-xs">
                  <thead className="bg-rose-50 text-left uppercase tracking-wide text-rose-400">
                    <tr>
                      <th className="px-3 py-2 w-10">Fila</th>
                      <th className="px-3 py-2">iduser sugerido</th>
                      <th className="px-3 py-2">Motivo del error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errExec.map((e, i) => (
                      <tr key={i} className="border-t border-rose-50">
                        <td className="px-3 py-1.5 text-slate-400">{e.fila}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-600">{e.iduser}</td>
                        <td className="px-3 py-1.5 text-rose-700">{e.mensaje}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PASO RESULTADO: éxito ── */}
          {paso === 'resultado' && importados.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-medium text-emerald-700">
                  {importados.length} usuario/s importado/s correctamente
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2">iduser</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Apellido</th>
                      <th className="px-3 py-2">Documento</th>
                      <th className="px-3 py-2">Perfil</th>
                      <th className="px-3 py-2">Suc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importados.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-mono font-medium text-brand-700">{r.iduser}</td>
                        <td className="px-3 py-1.5">{r.nombre}</td>
                        <td className="px-3 py-1.5">{r.apellido}</td>
                        <td className="px-3 py-1.5 font-mono">{r.documento}</td>
                        <td className="px-3 py-1.5">{r.perfil}</td>
                        <td className="px-3 py-1.5 font-mono">{r.idsucursal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <div>
            {paso === 'resultado' && importados.length > 0 && (
              <button className="btn-outline" onClick={() => exportarResultado(importados)}>
                <Download className="h-4 w-4" /> Exportar importados
              </button>
            )}
            {paso === 'resultado' && (errores.length > 0 || errExec.length > 0) && (
              <button
                className="btn-outline"
                onClick={() => { setFilas([]); setErrores([]); setErrExec([]); setArchivoErr(null); setErrWriteTxt(null); setPaso('preview'); }}
              >
                Corregir y reintentar
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button className="btn-outline" onClick={onClose}>Cerrar</button>
            {paso === 'preview' && filas.length > 0 && (
              <button
                className="btn-primary"
                disabled={importarM.isPending || filasConProblemas > 0}
                title={filasConProblemas > 0 ? `Corregí las ${filasConProblemas} fila/s con problemas antes de importar` : undefined}
                onClick={() => importarM.mutate()}
              >
                {importarM.isPending
                  ? 'Importando…'
                  : filasConProblemas > 0
                    ? `${filasConProblemas} fila/s con problemas`
                    : `Importar ${filas.length} usuario/s`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
