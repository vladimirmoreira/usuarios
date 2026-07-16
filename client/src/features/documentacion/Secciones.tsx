import { useMemo, useState } from 'react';
import { Search, X, Printer } from 'lucide-react';

/* ── Modelo de contenido (render + búsqueda) ────────────────────────────── */
export type Bloque =
  | { t: 'p'; texto: string }
  | { t: 'sub'; texto: string }
  | { t: 'ul'; items: string[] }
  | { t: 'tabla'; head: string[]; filas: string[][] }
  | { t: 'pasos'; items: string[] }
  | { t: 'img'; svg: string; caption?: string };

export type Seccion = { id: string; titulo: string; icon: any; bloques: Bloque[] };

function textoDe(s: Seccion): string {
  return (s.titulo + ' ' + s.bloques.map((b) =>
    b.t === 'p' || b.t === 'sub' ? b.texto
      : b.t === 'ul' || b.t === 'pasos' ? b.items.join(' ')
      : b.t === 'img' ? (b.caption || '')
      : [...b.head, ...b.filas.flat()].join(' ')).join(' ')).toLowerCase();
}

export function Bloques({ bloques }: { bloques: Bloque[] }) {
  return (
    <div className="space-y-3">
      {bloques.map((b, i) => {
        if (b.t === 'p') return <p key={i} className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{b.texto}</p>;
        if (b.t === 'sub') return <h4 key={i} className="pt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{b.texto}</h4>;
        if (b.t === 'ul') return (
          <ul key={i} className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
            {b.items.map((it, j) => <li key={j}>{it}</li>)}
          </ul>
        );
        if (b.t === 'pasos') return (
          <ol key={i} className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{j + 1}</span>
                <span>{it}</span>
              </li>
            ))}
          </ol>
        );
        if (b.t === 'img') return (
          <figure key={i} className="my-1">
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
              dangerouslySetInnerHTML={{ __html: b.svg }} />
            {b.caption && <figcaption className="mt-1 text-center text-xs text-zinc-400">{b.caption}</figcaption>}
          </figure>
        );
        return (
          <div key={i} className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  {b.head.map((h, j) => <th key={j} className="px-3 py-1.5 text-left font-semibold text-zinc-500 dark:text-zinc-400">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {b.filas.map((f, j) => (
                  <tr key={j} className="border-b border-zinc-100 dark:border-zinc-800">
                    {f.map((c, k) => <td key={k} className="px-3 py-1.5 align-top text-zinc-600 dark:text-zinc-300">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/** Vista reutilizable: encabezado + buscador + índice (TOC) + secciones. */
export function SeccionesView({
  titulo, subtitulo, headerIcon: HeaderIcon, secciones, footer,
}: {
  titulo: string; subtitulo: string; headerIcon: any; secciones: Seccion[]; footer?: string;
}) {
  const [q, setQ] = useState('');
  const filtro = q.trim().toLowerCase();
  const visibles = useMemo(
    () => (filtro ? secciones.filter((s) => textoDe(s).includes(filtro)) : secciones),
    [filtro, secciones],
  );
  const irA = (id: string) => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const imprimir = () => { setQ(''); setTimeout(() => window.print(), 150); };
  const fecha = new Date().toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="doc-print mx-auto max-w-5xl">
      {/* Portada e índice: solo al imprimir / exportar a PDF */}
      <div className="print-only manual-cover">
        <div className="mc-mark">A</div>
        <div className="mc-kicker">Módulo de Gestión de Usuarios</div>
        <h1 className="mc-title">{titulo}</h1>
        <p className="mc-sub">{subtitulo}</p>
        <p className="mc-date">{fecha}</p>
      </div>
      <div className="print-only manual-toc">
        <h2>Índice</h2>
        <ol>
          {secciones.map((s) => <li key={s.id}>{s.titulo}</li>)}
        </ol>
      </div>

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
            <HeaderIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">{titulo}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitulo}</p>
          </div>
        </div>
        <button onClick={imprimir}
          className="no-print inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          title="Genera un manual en PDF con portada e índice (elegí “Guardar como PDF” en el diálogo)">
          <Printer className="h-4 w-4" /> Descargar manual
        </button>
      </div>

      <div className="no-print relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input className="input pl-9 pr-9" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && (
          <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-6">
        <nav className="no-print hidden w-56 shrink-0 lg:block">
          <div className="sticky top-4 space-y-1">
            {visibles.map((s) => (
              <button key={s.id} onClick={() => irA(s.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                <s.icon className="h-4 w-4 shrink-0 text-brand-500" />
                <span className="truncate">{s.titulo}</span>
              </button>
            ))}
            {visibles.length === 0 && <p className="px-3 text-xs text-zinc-400">Sin resultados</p>}
          </div>
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          {visibles.map((s) => (
            <section key={s.id} id={`sec-${s.id}`} className="doc-sec scroll-mt-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-3 flex items-center gap-2">
                <s.icon className="h-5 w-5 text-brand-600" />
                <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{s.titulo}</h3>
              </div>
              <Bloques bloques={s.bloques} />
            </section>
          ))}
          {visibles.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No se encontró nada para “{q}”.
            </div>
          )}
          {footer && <p className="pb-6 text-center text-xs text-zinc-400">{footer}</p>}
        </div>
      </div>
    </div>
  );
}
