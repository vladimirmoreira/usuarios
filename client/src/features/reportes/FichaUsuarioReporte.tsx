import { useEffect, useState } from 'react';
import { Download, Copy, Check, User, CheckSquare, Square } from 'lucide-react';
import type { FichaUsuario } from '../../api/endpoints';
import api from '../../api/client';
import toast from '../../lib/notify';

export default function FichaUsuarioReporte({ data }: { data: FichaUsuario }) {
  const u = data.usuario;
  const estado = estadoLabel(u.estado);

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

  return (
    <div className="p-5 text-sm text-zinc-800 dark:text-zinc-100">
      {/* Encabezado */}
      <Header
        titulo="Ficha de Usuario"
        subtitulo={`${u.iduser} — ${u.apellido} ${u.nombre}`}
        generadoEn={data.generadoEn}
      />

      {/* Datos básicos */}
      <Seccion titulo="Datos básicos">
        <div className="flex items-start justify-between gap-4">
        <DL>
          <DT>iduser</DT><DD className="font-mono">{u.iduser}</DD>
          <DT>Nombre</DT><DD>{u.nombre} {u.apellido}</DD>
          <DT>Documento</DT><DD>{u.documento || '—'}</DD>
          <DT>Perfil</DT><DD>{u.perfil_descripcion || `#${u.idtipo_usuario}`}</DD>
          <DT>Estado</DT><DD><Badge color={estado.color}>{estado.label}</Badge></DD>
          <DT>Empresa</DT><DD>{u.idempresa || '—'}</DD>
          <DT>Permisos personalizados</DT>
          <DD>{u.exclusion_permisos ? <Badge color="amber">Sí</Badge> : <Badge color="zinc">No</Badge>}</DD>
          <DT>Sin menú</DT>
          <DD>{u.sin_menu ? <Badge color="red">Sí</Badge> : <Badge color="green">No</Badge>}</DD>
        </DL>
          <FotoUsuario iduser={u.iduser} />
        </div>
      </Seccion>

      {/* Sucursales y Depósitos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Seccion titulo={`Sucursales (${data.sucursales.length})`}>
          {data.sucursales.length === 0 ? (
            <Vacio>No tiene sucursales asignadas.</Vacio>
          ) : (
            <ul className="text-sm space-y-0.5">
              {data.sucursales.map((s) => (
                <li key={s.idsucursal} className="flex gap-2">
                  <span className="text-zinc-400 w-6 text-right">{s.orden || '·'}</span>
                  <span>{s.nombre}</span>
                  <span className="text-zinc-400 text-xs">#{s.idsucursal}</span>
                </li>
              ))}
            </ul>
          )}
        </Seccion>

        <Seccion titulo="Depósitos">
          <div className="text-xs">
            <p className="font-semibold text-zinc-500 mb-1">Salida ({data.depositos.salida.length})</p>
            {data.depositos.salida.length === 0 ? <Vacio>Ninguno.</Vacio> : (
              <ul className="space-y-0.5 mb-2">
                {data.depositos.salida.map((d) => (
                  <li key={`s-${d.iddeposito}`}>
                    <span className="text-zinc-400">{d.orden || '·'}</span>{' '}
                    {d.descripcion} <span className="text-zinc-400">#{d.iddeposito}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="font-semibold text-zinc-500 mb-1">Entrada ({data.depositos.entrada.length})</p>
            {data.depositos.entrada.length === 0 ? <Vacio>Ninguno.</Vacio> : (
              <ul className="space-y-0.5">
                {data.depositos.entrada.map((d) => (
                  <li key={`e-${d.iddeposito}`}>
                    <span className="text-zinc-400">{d.orden || '·'}</span>{' '}
                    {d.descripcion} <span className="text-zinc-400">#{d.iddeposito}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Seccion>
      </div>

      {/* Complemento + Vínculos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Seccion titulo="Complemento (USUARIOEMPRESA)">
          {!data.complemento ? <Vacio>Sin datos.</Vacio> : (
            <DL>
              <DT>Modo print</DT><DD>{nz(data.complemento.modo_print)}</DD>
              <DT>Talonario</DT><DD>{nz(data.complemento.talonario)}</DD>
              <DT>Descuento</DT><DD>{nz(data.complemento.descuento)}</DD>
            </DL>
          )}
        </Seccion>

        <Seccion titulo="Vínculos">
          <div className="text-xs space-y-2">
            <div>
              <span className="font-semibold text-zinc-500">Legajo (RH): </span>
              {data.vinculos.legajo ? (
                <>
                  <span className="font-medium">{data.vinculos.legajo.apellido}, {data.vinculos.legajo.nombre}</span>
                  {' '}<span className="text-zinc-500">— doc {data.vinculos.legajo.nrodocumento}</span>
                  {data.vinculos.legajo.idcargo != null && (
                    <span className="text-zinc-500"> · cargo #{data.vinculos.legajo.idcargo}{' '}
                      {data.vinculos.legajo.cargo_estado === 1
                        ? <Badge color="green">activo</Badge>
                        : <Badge color="zinc">inactivo</Badge>}
                    </span>
                  )}
                </>
              ) : <span className="text-zinc-400">Sin vínculo.</span>}
            </div>
            <div>
              <span className="font-semibold text-zinc-500">Mesero (GG): </span>
              {data.vinculos.mesero ? (
                <>
                  <span className="font-medium">{data.vinculos.mesero.nombre}</span>
                  {' '}<span className="text-zinc-500">— doc {data.vinculos.mesero.nrodocumento}</span>
                  {' '}<span className="text-zinc-500">· suc {data.vinculos.mesero.idsucursal ?? '—'}</span>
                  {' '}{data.vinculos.mesero.estado === 1
                        ? <Badge color="green">activo</Badge>
                        : <Badge color="zinc">inactivo</Badge>}
                </>
              ) : <span className="text-zinc-400">Sin vínculo.</span>}
            </div>
          </div>
        </Seccion>
      </div>

      {/* Permisos del Rol/Personalizados */}
      <Seccion titulo={`Permisos generales (${permActivos.length} activos)${data.accesos.edicion_rol ? ' — heredado del rol' : ''}`}>
        {permActivos.length === 0 ? <Vacio>Ninguno.</Vacio> : <Chips items={permActivos} />}
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

      {/* Menú */}
      <Seccion titulo={`Menú habilitado (${menuHab.length} de ${data.accesos.menu.length})`}>
        {menuHab.length === 0 ? <Vacio>Sin ítems habilitados.</Vacio> : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-0.5 text-xs">
            {menuHab.map((m) => (
              <div key={m.idmenu_principal} className="truncate">
                <span className="text-zinc-400 font-mono">{m.idmenu}</span> {m.titulo}
              </div>
            ))}
          </div>
        )}
      </Seccion>

      {/* Conceptos */}
      <Seccion titulo="Conceptos por tipo de movimiento">
        <ConceptosTable data={data.conceptos} />
      </Seccion>

      {/* Historial */}
      <Seccion titulo={`Historial reciente (${data.historialReciente.length} de ${data.historialTotal} eventos)`}>
        {data.historialReciente.length === 0 ? <Vacio>Sin eventos.</Vacio> : (
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="py-1 pr-2">Fecha</th>
                <th className="py-1 pr-2">Operación</th>
                <th className="py-1 pr-2">Autoriz.</th>
                <th className="py-1">Observación</th>
              </tr>
            </thead>
            <tbody>
              {data.historialReciente.map((h) => (
                <tr key={h.id} className="border-b border-zinc-100">
                  <td className="py-1 pr-2 whitespace-nowrap">{formatFecha(h.fecha)}</td>
                  <td className="py-1 pr-2">
                    <span className="mr-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded bg-zinc-800 px-1 text-[9px] font-semibold text-white">
                      {h.idoperacion}
                    </span>
                    {h.descripcion}
                  </td>
                  <td className="py-1 pr-2 font-mono">{h.autorizacion}</td>
                  <td className="py-1 text-zinc-600">{h.observacion || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Seccion>
    </div>
  );
}

// ─── Helpers compartidos (también usados por FichaRolReporte) ───────────
export function Header({ titulo, subtitulo, generadoEn }: { titulo: string; subtitulo: string; generadoEn: string }) {
  return (
    <div className="border-b-2 border-zinc-800 pb-2 mb-4 flex items-end justify-between">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{titulo}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">{subtitulo}</p>
      </div>
      <div className="text-xs text-zinc-500 text-right">
        Generado: {new Date(generadoEn).toLocaleString()}
      </div>
    </div>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 break-inside-avoid">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 pb-0.5 mb-2">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export function DL({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[160px_1fr] gap-y-1 text-xs">{children}</dl>;
}
export function DT({ children }: { children: React.ReactNode }) {
  return <dt className="font-semibold text-zinc-500">{children}</dt>;
}
export function DD({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <dd className={className}>{children}</dd>;
}

export function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] text-zinc-700">
          {it}
        </span>
      ))}
    </div>
  );
}

/**
 * Lista de permisos del catálogo con indicador de check (activado / no).
 * Se usa en la Ficha de Rol para mostrar TODO el catálogo y cuáles están marcados.
 */
export function ChecklistPermisos({
  catalogo, flags,
}: { catalogo: { descripcion: string }[]; flags: boolean[] }) {
  if (!catalogo.length) return <Vacio>Sin catálogo de permisos.</Vacio>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-0.5 text-[11px]">
      {catalogo.map((c, i) => {
        const on = !!flags[i];
        return (
          <div key={i} className="flex items-center gap-1">
            {on
              ? <CheckSquare className="h-3 w-3 shrink-0 text-emerald-600" />
              : <Square className="h-3 w-3 shrink-0 text-zinc-300" />}
            <span className={on ? 'text-zinc-800' : 'text-zinc-400'}>{c.descripcion}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Badge({
  children, color = 'zinc',
}: { children: React.ReactNode; color?: 'zinc' | 'green' | 'red' | 'amber' | 'brand' }) {
  const cls: Record<string, string> = {
    zinc:  'bg-zinc-100 text-zinc-700',
    green: 'bg-green-100 text-green-800',
    red:   'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    brand: 'bg-brand-100 text-brand-800',
  };
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls[color]}`}>{children}</span>;
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-zinc-400 italic">{children}</p>;
}

// ─── Foto de usuario (lee el blob binario con token; copiar/descargar) ──────
function toPngBlob(src: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const u = URL.createObjectURL(src);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(u); return reject(new Error('no ctx')); }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(u);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob null'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('img error')); };
    img.src = u;
  });
}

export function FotoUsuario({ iduser }: { iduser: string }) {
  const [url, setUrl]     = useState<string | null>(null);
  const [blob, setBlob]   = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    let active = true;
    let objUrl: string | null = null;
    setLoading(true);
    api.get(`/usuarios/${iduser}/foto`, { responseType: 'blob' })
      .then((r) => {
        if (!active) return;
        const b = r.data as Blob;
        objUrl = URL.createObjectURL(b);
        setBlob(b); setUrl(objUrl);
      })
      .catch(() => { if (active) { setBlob(null); setUrl(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [iduser]);

  const descargar = () => {
    if (!url) return;
    const ext = (blob?.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const a = document.createElement('a');
    a.href = url; a.download = `${iduser}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const copiar = async () => {
    if (!blob) return;
    try {
      const png = await toPngBlob(blob);
      // @ts-ignore ClipboardItem puede no estar tipado en algunos TS lib targets
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setCopied(true); toast.success('Foto copiada al portapapeles');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('No se pudo copiar la imagen (probá descargarla)');
    }
  };

  if (loading) {
    return <div className="h-28 w-28 shrink-0 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />;
  }
  if (!url) {
    return (
      <div className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 text-zinc-400">
        <User className="h-8 w-8" />
        <span className="mt-1 text-[10px]">Sin foto</span>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <img src={url} alt={`Foto ${iduser}`} className="h-28 w-28 rounded-lg object-cover ring-1 ring-zinc-200 dark:ring-zinc-700" />
      <div className="flex gap-1.5 print:hidden">
        <button type="button" onClick={copiar} className="btn-outline px-2 py-1 text-[11px]" title="Copiar al portapapeles">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} Copiar
        </button>
        <button type="button" onClick={descargar} className="btn-outline px-2 py-1 text-[11px]" title="Descargar imagen">
          <Download className="h-3.5 w-3.5" /> Descargar
        </button>
      </div>
    </div>
  );
}

function nz(v: number | null | undefined): string {
  return v == null ? '—' : String(v);
}

function estadoLabel(e: number): { label: string; color: 'green' | 'red' | 'amber' | 'zinc' } {
  if (e === 1) return { label: 'Activo',    color: 'green' };
  if (e === 0) return { label: 'Inactivo',  color: 'red' };
  if (e === 2) return { label: 'Bloqueado', color: 'amber' };
  return { label: `Estado ${e}`, color: 'zinc' };
}

function formatFecha(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Tabla compacta de conceptos por tipo.
// - mostrarTodos=false (Ficha Usuario): solo los conceptos habilitados (permiso=1).
// - mostrarTodos=true  (Ficha Rol): TODO el catálogo, con indicador de check por concepto.
export function ConceptosTable({
  data, mostrarTodos = false,
}: { data: FichaUsuario['conceptos']; mostrarTodos?: boolean }) {
  if (!data.grupos.length) return <Vacio>Sin tipos de movimiento.</Vacio>;
  return (
    <div className="space-y-2">
      {data.grupos.map((g) => {
        const activos = g.conceptos.filter((c) => c.permiso);
        const lista = mostrarTodos ? g.conceptos : activos;
        return (
          <div key={g.tipo} className="break-inside-avoid">
            <p className="text-xs font-semibold text-zinc-700 mb-1">
              {g.label} <span className="text-zinc-400">({activos.length} de {g.conceptos.length})</span>
            </p>
            {lista.length === 0 ? (
              <Vacio>{mostrarTodos ? 'Sin conceptos.' : 'Sin conceptos activos.'}</Vacio>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="text-[10px] uppercase text-zinc-500 border-b border-zinc-200">
                  <tr>
                    {mostrarTodos && <th className="py-0.5 pr-1 w-5"></th>}
                    <th className="py-0.5 text-left pr-2">Concepto</th>
                    <th className="py-0.5 text-left">Permisos de acción</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => {
                    const on = !!c.permiso;
                    const acciones = c.permisoVarios
                      .map((v, i) => (v ? data.permisosCatalogo[i]?.descripcion : null))
                      .filter(Boolean) as string[];
                    return (
                      <tr key={c.idtipomovimiento} className={`border-b border-zinc-100 align-top ${mostrarTodos && !on ? 'text-zinc-400' : ''}`}>
                        {mostrarTodos && (
                          <td className="py-0.5 pr-1">
                            {on
                              ? <CheckSquare className="h-3 w-3 text-emerald-600" />
                              : <Square className="h-3 w-3 text-zinc-300" />}
                          </td>
                        )}
                        <td className="py-0.5 pr-2 font-mono whitespace-nowrap">
                          {c.idtipomovimiento}-{c.descripcion}
                        </td>
                        <td className="py-0.5 text-zinc-600">
                          {on
                            ? (acciones.length ? acciones.join(' · ') : <span className="text-zinc-400 italic">ninguno</span>)
                            : <span className="text-zinc-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
