import { useMemo, useState } from 'react';
import { Search, CheckSquare, Square } from 'lucide-react';
import type { MenuItem } from '../../../api/endpoints';

// ---------------------------------------------------------------------------
// Relaciones padre → hijos del menú legado.
// Los ítems PADRE se ocultan de la UI y su permiso se sincroniza
// automáticamente: 1 si algún hijo está marcado, 0 si todos están desmarcados.
// ---------------------------------------------------------------------------
const PARENT_CHILDREN: Record<string, string[]> = {
  Pagare1:                     ['mnuPagaresalaOrden', 'mnuPagareDeudas'],
  PlanillasdeCaja1:            ['popAdmPlanillaCajaRendicion', 'popAdmPlanillaCajaCajaChica',
                                 'popAdminPlanillaViaticos', 'popPlanilladeCajaImpresion'],
  mnuAdmMoculosLibrodeBancos:  ['LibroBanco1'],
  mnuAdmDespachodeImportacion: ['DespachoGeeral1', 'DespachoDesglosado1', 'ImportacionEmbarque'],
  mnuAdminDefiniciones:        ['Cuentas1', 'Cambio1', 'CambioOficial1', 'Morosos1', 'popCfgValoresvarios'],
  mnuTecnicoDefiniciones:       ['ValoresdeConfig1', 'OpcionesdeServicios1', 'GruposOT1',
                                 'TipoProyecto1', 'TipoDocumento1', 'UsuarioProyecto1'],
  popProd_Recetas:              ['AdministracindeRecetas1', 'SimuladordeRecetas1'],
  Etiquetas1:                   ['Etiqueta1', 'Etiqueta2'],
};

/** idmenus que actúan como cabeceras → ocultos en la UI. */
const HIDDEN_PARENTS = new Set(Object.keys(PARENT_CHILDREN));

/** idmenus que se ocultan y se fuerzan siempre a permiso = 0. */
const FORZAR_OFF = new Set([
  'mnuArchivoConfigImpresora',
  'mnuArchivoPanelControl',
  'mnuUtilesAnalizador',
  'mnuUtilesAdminDatos',
  'mnuUtilesGestiondeAvisos',
  'GeneradorSQL1',
  'GeneradordeFacturas1',
  'Cubo1',
  'SincronizarID1',
  'Exportador1',
  'ConfigurarGrilla1',
  'PaneldeControl1',
  'PlanillaProgramacion',
  'ValoresdeConfig1',
  // Informes: Margen/Objetivos y submenús
  'mnuInformeMargenUtilidad',
  'MargendeUtilidad1',
  'ObjetivosdeVentas1',
  // Utilidades
  'EnviarCorreo1',
  'ListadeRUC1',
  'Costo1',
  // Configuración
  'popCfgValoresvarios',
]);

/** idmenus que se ocultan y se fuerzan siempre a permiso = 1. */
const FORZAR_ON = new Set([
  'mnuArchivoBloquearSistema',
  'mnuArchivoSalir',
]);

/**
 * Padre visible → hijos ocultos que heredan su permiso automáticamente.
 * El padre permanece visible; los hijos nunca aparecen en la UI.
 */
const SHADOW_CHILDREN: Record<string, string[]> = {
  mnuInofrmeFlujodeCaja: ['Presupuesto1'],
};
const SHADOW_CHILDREN_SET = new Set(Object.values(SHADOW_CHILDREN).flat());

/** idmenus que solo se muestran cuando el editor está en modo Rol Admin. */
const SOLO_ADMIN_IDS = new Set(['popJediQuery']);

// ---------------------------------------------------------------------------
// Títulos manuales para ítems con título vacío en menu_general
// ---------------------------------------------------------------------------
const TITULO_MANUAL: Record<string, string> = {
  mnuPagaresalaOrden:          'Pagaré a la Orden',
  mnuPagareDeudas:             'Reconocimiento de Deudas',
  popAdmPlanillaCajaRendicion: 'Planilla de Caja',
  popAdmPlanillaCajaCajaChica: 'Rendición Caja Chica',
  popAdminPlanillaViaticos:    'Rendición Anticipos p/ Gastos',
  popPlanilladeCajaImpresion:  'Planilla de Caja - Impresión',
  LibroBanco1:                 'Libro Bancos',
  DespachoGeeral1:             'Despacho General',
  DespachoDesglosado1:         'Despacho Desglosado',
  ImportacionEmbarque:         'Importación/Embarque',
  Cuentas1:                    'Definición de Cuentas',
  Cambio1:                     'Cambio',
  CambioOficial1:              'Cambio Oficial',
  Morosos1:                    'Morosos',
  popCfgValoresvarios:         'Valores varios...',
  // Técnico
  mnuTecnicoOrdenTrabajo:      'Orden de Trabajo',
  Administracin1:              'Administración de Proyectos',
  ValoresdeConfig1:            'Valores de Configuración',
  OpcionesdeServicios1:        'Opciones de Servicios',
  GruposOT1:                   'Grupos OT',
  TipoProyecto1:               'Tipo Proyecto',
  TipoDocumento1:              'Tipo Documento',
  UsuarioProyecto1:            'Usuario Proyecto',
  // Servicios / Producción
  OrdendeServicio1:            'Orden de Servicio',
  AdministracindeRecetas1:     'Administración de Recetas',
  SimuladordeRecetas1:         'Simulador de Recetas',
  Etiqueta1:                   'Etiqueta (1)',
  Etiqueta2:                   'Etiqueta (2)',
  // Configuración
  mnuCierrePropiedades:        'Procesos',
};

// ---------------------------------------------------------------------------
// Grupo manual para ítems que el patrón automático clasificaría mal
// ---------------------------------------------------------------------------
const GRUPO_MANUAL: Record<string, string> = {
  // ── Administración ──────────────────────────────────────────────────────
  popAdmPlanillaCajaRendicion: 'Administración',
  popAdmPlanillaCajaCajaChica: 'Administración',
  popAdminPlanillaViaticos:    'Administración',
  popPlanilladeCajaImpresion:  'Administración',
  LibroBanco1:                 'Administración',
  Cuentas1:                    'Administración',
  Cambio1:                     'Administración',
  CambioOficial1:              'Administración',
  Morosos1:                    'Administración',
  menAdmOrdenPagos:            'Administración',
  mnuAdmFacturasaVencer:       'Administración',
  mnuInofrmeFlujodeCaja:       'Administración',
  VerificacinComisin1:         'Administración',
  CashFlow1:                   'Administración',
  popCheques:                  'Administración',
  // ── Ficha ────────────────────────────────────────────────────────────────
  mnuCuentasPersona:           'Ficha',
  // ── Logística/Producción ──────────────────────────────────────────────────
  // Producción (primero)
  OrdendeServicio1:            'Logística/Producción',
  popProd_Orden:               'Logística/Producción',
  AdministracindeRecetas1:     'Logística/Producción',
  SimuladordeRecetas1:         'Logística/Producción',
  Etiqueta1:                   'Logística/Producción',
  Etiqueta2:                   'Logística/Producción',
  // Reposición
  Reposicion:                  'Logística/Producción',
  // Despacho/Importación → Administración
  DespachoGeeral1:             'Administración',
  DespachoDesglosado1:         'Administración',
  ImportacionEmbarque:         'Administración',
  // ── Configuración ───────────────────────────────────────────────────────
  popCfgValoresvarios:         'Configuración',
  mnuCierrePropiedades:        'Configuración',
  ActivadorCallCenter1:        'Configuración',
  // ── Técnico (Administracin1 contiene 'adm' → se reclasifica) ────────────
  Administracin1:              'Técnico',
  ValoresdeConfig1:            'Técnico',
  OpcionesdeServicios1:        'Técnico',
  GruposOT1:                   'Técnico',
  TipoProyecto1:               'Técnico',
  TipoDocumento1:              'Técnico',
  UsuarioProyecto1:            'Técnico',
  // ── Producción ──────────────────────────────────────────────────────────
  // (ítems de producción ya incluidos en Logística/Producción arriba)
};

// ---------------------------------------------------------------------------
// Orden explícito de ítems dentro del grupo Administración
// ---------------------------------------------------------------------------
const ORDEN_ADMIN: Record<string, number> = {
  mnuCuentasACobrar:           0,
  mnuCuentasAPagar:            1,
  mnuCuentasRecibos:           2,
  menAdmOrdenPagos:            3,
  popAdmPlanillaCajaRendicion: 4,
  popAdmPlanillaCajaCajaChica: 5,
  popAdminPlanillaViaticos:    6,
  popPlanilladeCajaImpresion:  7,
  LibroBanco1:                 8,
  popCheques:                  9,
  Cuentas1:                    10,
  Cambio1:                     11,
  CambioOficial1:              12,
  Morosos1:                    13,
  mnuPagaresalaOrden:          14,
  mnuPagareDeudas:             15,
  mnuAdmFacturasaVencer:       16,
  mnuInofrmeFlujodeCaja:       17,
  VerificacinComisin1:         18,
  CashFlow1:                   19,
  DespachoGeeral1:             20,
  DespachoDesglosado1:         21,
  ImportacionEmbarque:         22,
};

// ---------------------------------------------------------------------------
// Orden explícito de ítems dentro del grupo Logística/Producción
// ---------------------------------------------------------------------------
const ORDEN_LOG_PROD: Record<string, number> = {
  // Producción (primero)
  OrdendeServicio1:        0,
  popProd_Orden:           1,
  AdministracindeRecetas1: 2,
  SimuladordeRecetas1:     3,
  Etiqueta1:               4,
  Etiqueta2:               5,
  // Logística
  // Reposión
  Reposicion:              6,
};

// ---------------------------------------------------------------------------
// Recalcula el permiso de todos los padres según el estado de sus hijos.
// ---------------------------------------------------------------------------
function syncParents(items: MenuItem[]): MenuItem[] {
  let result = items;
  for (const [parent, children] of Object.entries(PARENT_CHILDREN)) {
    const anyActive = items.some((it) => children.includes(it.idmenu) && it.permiso === 1);
    result = result.map((it) =>
      it.idmenu === parent ? { ...it, permiso: anyActive ? 1 : 0 } : it,
    );
  }
  return result;
}

/** Propaga el permiso del padre a sus hijos fantasma. */
function syncShadowChildren(items: MenuItem[]): MenuItem[] {
  let result = items;
  for (const [parent, children] of Object.entries(SHADOW_CHILDREN)) {
    const parentItem = result.find((it) => it.idmenu === parent);
    if (!parentItem) continue;
    result = result.map((it) =>
      children.includes(it.idmenu) ? { ...it, permiso: parentItem.permiso } : it,
    );
  }
  return result;
}

function aplicarForzados(items: MenuItem[]): MenuItem[] {
  return items.map((it) => {
    if (FORZAR_OFF.has(it.idmenu)) return { ...it, permiso: 0 };
    if (FORZAR_ON.has(it.idmenu)) return { ...it, permiso: 1 };
    return it;
  });
}

export default function MenuTab({
  items,
  onChange,
  esAdmin = false,
  readOnly = false,
}: {
  items: MenuItem[];
  onChange: (next: MenuItem[]) => void;
  esAdmin?: boolean;
  readOnly?: boolean;
}) {
  const [filtro, setFiltro] = useState('');

  const grupos = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      if (/^mnuAdmMovimientos\d+$/i.test(it.idmenu)) continue;
      if (/FinancieroOF/i.test(it.idmenu)) continue;
      if (HIDDEN_PARENTS.has(it.idmenu)) continue;
      if (FORZAR_OFF.has(it.idmenu) || FORZAR_ON.has(it.idmenu)) continue;
      if (SHADOW_CHILDREN_SET.has(it.idmenu)) continue;
      if (!esAdmin && SOLO_ADMIN_IDS.has(it.idmenu)) continue;
      const g = inferirGrupo(it.idmenu);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(it);
    }
    const admItems = map.get('Administración');
    if (admItems) admItems.sort((a, b) => (ORDEN_ADMIN[a.idmenu] ?? 999) - (ORDEN_ADMIN[b.idmenu] ?? 999));
    const lpItems = map.get('Logística/Producción');
    if (lpItems) lpItems.sort((a, b) => (ORDEN_LOG_PROD[a.idmenu] ?? 999) - (ORDEN_LOG_PROD[b.idmenu] ?? 999));
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ia = ORDEN_GRUPOS.indexOf(a);
      const ib = ORDEN_GRUPOS.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [items, esAdmin]);

  const setPermiso = (idmenu_principal: number, v: number) => {
    if (readOnly) return;
    const updated = items.map((it) =>
      it.idmenu_principal === idmenu_principal ? { ...it, permiso: v } : it,
    );
    onChange(aplicarForzados(syncParents(syncShadowChildren(updated))));
  };

  const toggleGrupo = (grupo: string, todos: boolean) => {
    if (readOnly) return;
    const updated = items.map((it) =>
      inferirGrupo(it.idmenu) === grupo ? { ...it, permiso: todos ? 1 : 0 } : it,
    );
    onChange(aplicarForzados(syncParents(syncShadowChildren(updated))));
  };

  const filtroLower = filtro.toLowerCase();

  return (
    <div className="space-y-2">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
        <input
          className="input pl-9"
          placeholder="Filtrar por título…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {grupos.map(([grupo, lista]) => {
          const visibles = filtro
            ? lista.filter((i) => {
                const label = TITULO_MANUAL[i.idmenu] || limpiarTitulo(i.titulo) || i.idmenu;
                return label.toLowerCase().includes(filtroLower);
              })
            : lista;
          if (!visibles.length) return null;
          const activos = visibles.filter((i) => i.permiso === 1).length;
          const esGrande  = visibles.length >= 14;
          const esMediano = !esGrande && visibles.length >= 9;
          const multiCol  = esGrande || esMediano;
          return (
            <div
              key={grupo}
              className={`rounded-lg border border-zinc-200 bg-white${
                esGrande ? ' md:col-span-2 xl:col-span-3'
                : esMediano ? ' md:col-span-2'
                : ''
              }`}
            >
              <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-1.5">
                <h3 className="text-sm font-semibold text-zinc-700">{grupo}</h3>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>{activos}/{visibles.length}</span>
                  {!readOnly && (
                    <>
                      <button
                        className="text-brand-600 hover:underline"
                        onClick={() => toggleGrupo(grupo, true)}
                      >Todos</button>
                      <span className="text-zinc-300">|</span>
                      <button
                        className="text-zinc-500 hover:underline"
                        onClick={() => toggleGrupo(grupo, false)}
                      >Ninguno</button>
                    </>
                  )}
                </div>
              </div>
              <ul className={
                esGrande  ? 'columns-3'
                : esMediano ? 'columns-2'
                : 'max-h-64 divide-y divide-zinc-100 overflow-y-auto'
              }>
                {visibles.map((it) => (
                  <li
                    key={it.idmenu_principal}
                    className={multiCol ? 'break-inside-avoid border-b border-zinc-100' : undefined}
                  >
                    <button
                      onClick={() => !readOnly && setPermiso(it.idmenu_principal, it.permiso === 1 ? 0 : 1)}
                      className={`flex w-full items-center gap-1.5 px-2 py-0.5 text-left text-xs ${readOnly ? 'cursor-default' : 'hover:bg-zinc-50'}`}
                    >
                      {it.permiso === 1 ? (
                        <CheckSquare className="h-3.5 w-3.5 text-brand-600" />
                      ) : (
                        <Square className="h-3.5 w-3.5 text-zinc-300" />
                      )}
                      <span className={it.permiso === 1 ? 'text-zinc-800' : 'text-zinc-500'}>
                        {TITULO_MANUAL[it.idmenu] || limpiarTitulo(it.titulo) || it.idmenu}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Orden de grupos para el render (los grupos sin ítems no se muestran)
export const ORDEN_GRUPOS = [
  'Administración',
  'Ficha',
  'Configuración',
  'Logística/Producción',
  'Técnico',
  'Reportes',
];

function inferirGrupo(idmenu: string = ''): string {
  if (GRUPO_MANUAL[idmenu]) return GRUPO_MANUAL[idmenu];
  const s = idmenu.toLowerCase();
  // Administración: cuentas, pagos, instrumentos financieros
  if (s.includes('cuenta') || s.includes('pagare') || s.includes('financiero')) return 'Administración';
  // Logística/Producción: despacho, manufactura
  if (s.includes('logistica') || s.includes('produc')) return 'Logística/Producción';
  // Técnico: OTs, proyectos
  if (s.includes('tecnico')) return 'Técnico';
  // Reportes
  if (s.includes('rpt') || s.includes('reporte') || s.includes('informe')) return 'Reportes';
  // Stock/Artículos: fichas
  if (s.includes('stock')) return 'Ficha';
  // Configuración: archivos maestros, útiles, valores
  if (s.includes('archivo') || s.includes('utiles') || s.includes('cfg')) return 'Configuración';
  // Ficha: catch-all para ítems sin clasificación específica
  return 'Ficha';
}

function limpiarTitulo(t: string = '') {
  return t.replace(/&/g, '').trim();
}
