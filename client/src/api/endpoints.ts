import api from './client';

export type EmpresaOpcion = { idempresa: string; nombre: string };
export type LoginResp =
  | { multiEmpresa: true; empresas: EmpresaOpcion[] }
  | { accessToken: string; refreshToken: string; usuario: any };

export const AuthAPI = {
  // Fase 1: sin idempresa. Fase 2 (multi-empresa): con la empresa elegida del combo.
  login: (iduser: string, pass: string, idempresa?: string) =>
    api.post<LoginResp>('/auth/login', { iduser, pass, ...(idempresa ? { idempresa } : {}) }).then((r) => r.data),
};

export type Usuario = {
  iduser: string;
  nombre: string;
  apellido: string;
  documento: string;
  idtipo_usuario: number;
  estado: number;
  /** Nombre de la sucursal principal (orden 1) */
  sucursal_nombre?: string | null;
  /** 1 = no tiene filas en menu_general, debe configurarse */
  sin_menu: number;
  /** 1 = fue excluido de la última propagación del rol (permisos personalizados) */
  exclusion_permisos?: number;
  /** Fecha de caducidad del acceso (ISO) o null si no caduca */
  hasta_vigencia?: string | null;
};

export type Complemento = {
  modo_print: number | null;
  talonario:  number | null;
  descuento:  number | null;
};

export type SucursalPrincipal = { idsucursal: number; nombre: string } | null;
export type TurnoSucursal = { id: number; idsucursal: number; fecha: string };

export const UsuariosAPI = {
  listar: (params: { busqueda?: string; idperfil?: number; estado?: number }) =>
    api.get<Usuario[]>('/usuarios', { params }).then((r) => r.data),
  obtener: (iduser: string) => api.get<Usuario>(`/usuarios/${iduser}`).then((r) => r.data),
  crear: (data: any) => api.post('/usuarios', data).then((r) => r.data),
  baja: (iduser: string) => api.post(`/usuarios/${iduser}/baja`).then((r) => r.data),
  reactivar: (iduser: string) => api.post(`/usuarios/${iduser}/reactivar`).then((r) => r.data),
  vincularLegajo: (iduser: string) => api.post(`/usuarios/${iduser}/vincular-legajo`).then((r) => r.data),
  resetClave: (iduser: string) => api.post(`/usuarios/${iduser}/reset-clave`).then((r) => r.data),
  resetClaveIniciar: (iduser: string) =>
    api.post(`/usuarios/${iduser}/reset-clave/iniciar`).then((r) => r.data) as Promise<{ ok: boolean; simulado: boolean; mail_habilitado: boolean; codigo: string; expira_min: number }>,
  resetClaveConfirmar: (iduser: string, codigo: string, nuevaClave?: string) =>
    api.post(`/usuarios/${iduser}/reset-clave/confirmar`, { codigo, nuevaClave: nuevaClave || undefined }).then((r) => r.data),
  reasignarSucursal: (iduser: string, idsucursal: number) =>
    api.post(`/usuarios/${iduser}/reasignar-sucursal`, { idsucursal }).then((r) => r.data),
  cambiarPerfil: (iduser: string, idperfil: number) =>
    api.post(`/usuarios/${iduser}/cambiar-perfil`, { idperfil }).then((r) => r.data),
  clonarAEmpresa: (iduser: string, idempresaDestino: string) =>
    api.post<{ ok: boolean; clonado: boolean; empresa?: string; detalle?: string | string[] }>(`/usuarios/${iduser}/clonar-empresa`, { idempresaDestino }).then((r) => r.data),
  bloquearSinMenu: () => api.post('/usuarios/bloquear-sin-menu').then((r) => r.data),
  actualizar: (iduser: string, data: { nombre?: string; apellido?: string; documento?: string; hasta_vigencia?: string | null }) =>
    api.patch(`/usuarios/${iduser}`, data).then((r) => r.data),
  sugerirIduser: (nombre: string, apellido: string) =>
    api.get<{ sugerido: string | null }>('/usuarios/sugerir', { params: { nombre, apellido } }).then((r) => r.data),
  checkDocumento: (documento: string, excludeIduser?: string) =>
    api.get<{ disponible: boolean }>('/usuarios/check-documento', { params: { documento, excludeIduser } }).then((r) => r.data),
  getComplemento: (iduser: string) =>
    api.get<Complemento>(`/usuarios/${iduser}/complemento`).then((r) => r.data),
  updateComplemento: (iduser: string, data: Partial<Complemento>) =>
    api.patch(`/usuarios/${iduser}/complemento`, data).then((r) => r.data),
  historial: (iduser: string, params: { page?: number; pageSize?: number } = {}) =>
    api.get<HistorialPage>(`/usuarios/${iduser}/historial`, { params }).then((r) => r.data),
  sucursalPrincipal: (iduser: string) =>
    api.get<SucursalPrincipal>(`/usuarios/${iduser}/sucursal-principal`).then((r) => r.data),
  turnosMes: (iduser: string, anio: number, mes: number) =>
    api.get<TurnoSucursal[]>(`/usuarios/${iduser}/turnos`, { params: { anio, mes } }).then((r) => r.data),
  guardarTurnosMes: (iduser: string, anio: number, mes: number, items: { idsucursal: number; fecha: string }[]) =>
    api.post(`/usuarios/${iduser}/turnos`, { anio, mes, items }).then((r) => r.data),
  listarInactivos: (params: { dias?: number; diasPorCaducar?: number; idperfil?: number } = {}) =>
    api.get<InactividadResp>('/usuarios/inactividad', { params }).then((r) => r.data),
  inhabilitarUno: (iduser: string) =>
    api.post('/usuarios/inactividad/inhabilitar', { iduser }).then((r) => r.data),
  inhabilitarLote: (ids: string[], dias = 90) =>
    api.post('/usuarios/inactividad/inhabilitar', { ids, dias }).then((r) => r.data),
  exportCsv: async (params: { busqueda?: string; idperfil?: number; estado?: number } = {}) => {
    const r = await api.get<Blob>('/usuarios/export.csv', { params, responseType: 'blob' });
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url; a.download = `usuarios_${stamp}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  importar: (filas: FilaImportacion[]) =>
    api.post<ImportarResult>('/usuarios/importar', { filas }).then((r) => r.data),
};

export type FilaImportacion = {
  nombre:     string;
  apellido:   string;
  documento:  string;
  perfil:     string | number;
  idsucursal: string | number;
};

export type FilaImportada = {
  iduser:     string;
  nombre:     string;
  apellido:   string;
  documento:  string;
  perfil:     string;
  idsucursal: number;
};

export type ErrorImportacion = {
  fila:      number;
  nombre:    string;
  apellido:  string;
  documento: string;
  errores:   string[];
};

export type ImportarResult = {
  ok:               boolean;
  importados?:      FilaImportada[];
  erroresEjecucion?: { fila: number; iduser: string; mensaje: string }[];
  errores?:         ErrorImportacion[];
  archivoErrores?:  string;
};

export type MotivoIncidencia = 'caducado' | 'inactividad' | 'por_caducar';
export type InactivoRow = {
  iduser: string;
  nombre: string;
  apellido: string;
  idtipo_usuario: number;
  motivo: MotivoIncidencia;
  /** Inactividad (solo si aplica) */
  ultimaFecha?: string;  // YYYY-MM-DD
  diasInactivo?: number;
  /** Vigencia (solo si aplica) */
  hastaVigencia?: string; // YYYY-MM-DD
  diasParaCaducar?: number; // negativo si ya caducó
};
export type InactividadResp = {
  diasInactividad: number;
  diasPorCaducar: number;
  total: number;
  rows: InactivoRow[];
};

export type HistorialRow = {
  id: number;
  usuario: string;
  idoperacion: number;
  descripcion: string | null;
  fecha: string;
  autorizacion: string;
  observacion: string | null;
};
export type HistorialPage = {
  rows: HistorialRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MenuItem = {
  idmenu_principal: number;
  idmenu: string;
  titulo: string;
  permiso: number;
};

export type PermisoConcepto = {
  idpermiso_concepto: number;
  descripcion: string;
};

export type ConceptoConfig = {
  idtipomovimiento: number;
  descripcion: string;
  permiso: number;         // 0 = desactivado, 1 = activado
  permisoVarios: boolean[]; // 15 posiciones: true = elegido ('0'), false = no elegido ('1')
  // Personalización por usuario (solo se llenan/envían en modo 'usuario'):
  idtalonario?: number | null;
  idvendedor?:  number | null;
  idpersona?:   number | null;
  idplanventa?: number | null;
  idcondicion?: number | null;
};

export type GrupoConceptos = {
  tipo: number;
  label: string;
  conceptos: ConceptoConfig[];
};

export type ConceptosAccesos = {
  permisosCatalogo: PermisoConcepto[];
  grupos: GrupoConceptos[];
};

export type Accesos = {
  iduser: string;
  idempresa: string | null;
  /** true = los permisos de Menú/Flags/PDV/GG son de solo lectura (managed by role) */
  edicion_rol?: boolean;
  menu: MenuItem[];
  permisosGenerales: { catalogo: { idpermiso: number; descripcion: string }[]; flags: boolean[] };
  movimientos: { flags: boolean[] };
  pdv: { catalogo: { idpermiso: number; descripcion: string; indice: number }[]; flags: boolean[] };
  permisoGg: { flags: boolean[] };
};

export const AccesosAPI = {
  obtener: (iduser: string | number) => api.get<Accesos>(`/accesos/${iduser}`).then((r) => r.data),
  guardarMenu: (iduser: string, items: { idmenu_principal: number; permiso: number }[]) =>
    api.put(`/accesos/${iduser}/menu`, { items }).then((r) => r.data),
  guardarPermisosGenerales: (iduser: string, flags: boolean[]) =>
    api.put(`/accesos/${iduser}/permisos-generales`, { flags }).then((r) => r.data),
  guardarMovimientos: (iduser: string, flags: boolean[]) =>
    api.put(`/accesos/${iduser}/movimientos`, { flags }).then((r) => r.data),
  guardarPdv: (iduser: string, flags: boolean[]) =>
    api.put(`/accesos/${iduser}/pdv`, { flags }).then((r) => r.data),
  guardarPermisoGg: (iduser: string, flags: boolean[]) =>
    api.put(`/accesos/${iduser}/permiso-gg`, { flags }).then((r) => r.data),
  obtenerConceptos: (iduser: string) =>
    api.get<ConceptosAccesos>(`/accesos/${iduser}/conceptos`).then((r) => r.data),
  guardarConceptos: (iduser: string, items: ConceptoSavePayload[]) =>
    api.put(`/accesos/${iduser}/conceptos`, { items }).then((r) => r.data),
  obtenerSucursales: (iduser: string) =>
    api.get<{ items: SucursalUsuarioItem[] }>(`/accesos/${iduser}/sucursales`).then((r) => r.data),
  guardarSucursales: (iduser: string, items: SucursalUsuarioItem[]) =>
    api.put(`/accesos/${iduser}/sucursales`, { items }).then((r) => r.data),
  obtenerDepositos: (iduser: string) =>
    api.get<{ items: DepositoUsuarioItem[] }>(`/accesos/${iduser}/depositos`).then((r) => r.data),
  guardarDepositos: (iduser: string, items: DepositoUsuarioItem[]) =>
    api.put(`/accesos/${iduser}/depositos`, { items }).then((r) => r.data),
  obtenerMaster: (iduser: string) =>
    api.get<AccesosMaster>(`/accesos/${iduser}/master`).then((r) => r.data),
  guardarMaster: (iduser: string, data: AccesosMasterPayload) =>
    api.put(`/accesos/${iduser}/master`, data).then((r) => r.data),
};

export type AccesosMaster = {
  habilitado: boolean;
  permisos: boolean[]; // 9
  menu: boolean[];     // 19
  modulos: string;     // 3 chars '0/1'
};

export type AccesosMasterPayload = {
  permisos: boolean[]; // length 9
  menu: boolean[];     // length 19
};

export type ConceptoSavePayload = {
  idtipomovimiento: number;
  permiso: number;
  permisoVarios: boolean[];
  idtalonario?: number | null;
  idvendedor?:  number | null;
  idpersona?:   number | null;
  idplanventa?: number | null;
  idcondicion?: number | null;
};

export type AccesosApiAdapter = {
  obtener: (id: string | number) => Promise<Accesos & { rol?: any }>;
  guardarMenu: (id: string | number, items: { idmenu_principal: number; permiso: number }[]) => Promise<any>;
  guardarPermisosGenerales: (id: string | number, flags: boolean[]) => Promise<any>;
  guardarMovimientos: (id: string | number, flags: boolean[]) => Promise<any>;
  guardarPdv: (id: string | number, flags: boolean[]) => Promise<any>;
  guardarPermisoGg: (id: string | number, flags: boolean[]) => Promise<any>;
  obtenerConceptos?: (id: string | number) => Promise<ConceptosAccesos>;
  guardarConceptos?: (id: string | number, items: ConceptoSavePayload[]) => Promise<any>;
  obtenerSucursales?: (id: string | number) => Promise<{ items: SucursalUsuarioItem[] }>;
  guardarSucursales?: (id: string | number, items: SucursalUsuarioItem[]) => Promise<any>;
  obtenerDepositos?: (id: string | number) => Promise<{ items: DepositoUsuarioItem[] }>;
  guardarDepositos?: (id: string | number, items: DepositoUsuarioItem[]) => Promise<any>;
  obtenerMaster?: (id: string | number) => Promise<AccesosMaster>;
  guardarMaster?: (id: string | number, data: AccesosMasterPayload) => Promise<any>;
};

export type Rol = {
  idtipo_usuario: number;
  descripcion: string;
  iduser: string;
  tipo: number;
  estado: number;
  master?: number;
  edicion_rol?: number;
  menu_count?: number;
  /** Cantidad de ítems de menu_general con permiso=1 (permisos realmente activos) */
  permisos_activos?: number;
};

export type RolUsuario = {
  iduser: string;
  nombre: string;
  apellido: string;
  estado: number;
  exclusion_permisos: number;
};

export const RolesAPI = {
  listar: (params?: { estado?: number }) => api.get<Rol[]>('/roles', { params }).then((r) => r.data),
  crear: (data: { descripcion: string; iduser: string; tipo: number; master?: number; usuario_pdv?: number; idsucursal?: number | null; idtipo_mesero?: number | null }) =>
    api.post('/roles', data).then((r) => r.data),
  actualizar: (idperfil: number, data: { descripcion: string; tipo: number; estado: number; master?: number; edicion_rol?: number; usuario_pdv?: number; idsucursal?: number | null; idtipo_mesero?: number | null }) =>
    api.put(`/roles/${idperfil}`, data).then((r) => r.data),
  obtenerUsuarioPdv: (idperfil: number) =>
    api.get<{ habilitado: boolean; idsucursal: number | null; idtipo_mesero: number | null }>(`/roles/${idperfil}/usuario-pdv`).then((r) => r.data),
  eliminar: (idperfil: number) => api.delete(`/roles/${idperfil}`).then((r) => r.data),
  obtener: (idperfil: number | string) =>
    api.get<Accesos & { rol: Rol }>(`/roles/${idperfil}/accesos`).then((r) => r.data),
  guardarMenu: (idperfil: number | string, items: { idmenu_principal: number; permiso: number }[]) =>
    api.put(`/roles/${idperfil}/menu`, { items }).then((r) => r.data),
  guardarPermisosGenerales: (idperfil: number | string, flags: boolean[]) =>
    api.put(`/roles/${idperfil}/permisos-generales`, { flags }).then((r) => r.data),
  guardarMovimientos: (idperfil: number | string, flags: boolean[]) =>
    api.put(`/roles/${idperfil}/movimientos`, { flags }).then((r) => r.data),
  guardarPdv: (idperfil: number | string, flags: boolean[]) =>
    api.put(`/roles/${idperfil}/pdv`, { flags }).then((r) => r.data),
  guardarPermisoGg: (idperfil: number | string, flags: boolean[]) =>
    api.put(`/roles/${idperfil}/permiso-gg`, { flags }).then((r) => r.data),
  obtenerConceptos: (idperfil: number | string) =>
    api.get<ConceptosAccesos>(`/roles/${idperfil}/conceptos`).then((r) => r.data),
  guardarConceptos: (idperfil: number | string, items: ConceptoSavePayload[]) =>
    api.put(`/roles/${idperfil}/conceptos`, { items }).then((r) => r.data),
  obtenerSucursales: (idperfil: number | string) =>
    api.get<{ items: SucursalUsuarioItem[] }>(`/roles/${idperfil}/sucursales`).then((r) => r.data),
  guardarSucursales: (idperfil: number | string, items: SucursalUsuarioItem[]) =>
    api.put(`/roles/${idperfil}/sucursales`, { items }).then((r) => r.data),
  obtenerDepositos: (idperfil: number | string) =>
    api.get<{ items: DepositoUsuarioItem[] }>(`/roles/${idperfil}/depositos`).then((r) => r.data),
  guardarDepositos: (idperfil: number | string, items: DepositoUsuarioItem[]) =>
    api.put(`/roles/${idperfil}/depositos`, { items }).then((r) => r.data),
  obtenerMaster: (idperfil: number | string) =>
    api.get<AccesosMaster>(`/roles/${idperfil}/master`).then((r) => r.data),
  guardarMaster: (idperfil: number | string, data: AccesosMasterPayload) =>
    api.put(`/roles/${idperfil}/master`, data).then((r) => r.data),
  listarUsuarios: (idperfil: number | string) =>
    api.get<RolUsuario[]>(`/roles/${idperfil}/usuarios`).then((r) => r.data),
  propagar: (idperfil: number | string, excluidos: string[]) =>
    api.post<{ ok: boolean; propagados: number; excluidos: number; errores?: { iduser: string; mensaje: string }[]; sin_documento?: { iduser: string }[] }>(`/roles/${idperfil}/propagar`, { excluidos }).then((r) => r.data),
};

export const CatalogosAPI = {
  perfiles: () => api.get('/catalogos/perfiles').then((r) => r.data),
  sucursales: () => api.get('/catalogos/sucursales').then((r) => r.data),
  sucursalesLocales: () => api.get<SucursalLocal[]>('/catalogos/sucursales-locales').then((r) => r.data),
  tiposMesero: () => api.get<TipoMesero[]>('/catalogos/tipos-mesero').then((r) => r.data),
  talonarios: () => api.get<Talonario[]>('/catalogos/talonarios').then((r) => r.data),
  vendedores: () => api.get<Vendedor[]>('/catalogos/vendedores').then((r) => r.data),
  planventas: () => api.get<PlanVenta[]>('/catalogos/planventas').then((r) => r.data),
  condiciones: () => api.get<Condicion[]>('/catalogos/condiciones').then((r) => r.data),
  depositos: () => api.get<DepositoCatalogo[]>('/catalogos/depositos').then((r) => r.data),
  permisosMaster: () => api.get<PermisoMaster[]>('/catalogos/permisos-master').then((r) => r.data),
  menuMaster: () => api.get<MenuMasterItem[]>('/catalogos/menu-master').then((r) => r.data),
  operaciones: () => api.get<OperacionCatalogo[]>('/catalogos/operaciones').then((r) => r.data),
};

export type OperacionCatalogo = {
  id: number;
  descripcion: string;
  efectos: { bd: 'system' | 'server' | 'master' | 'externa'; accion: string; flag: string }[];
};

export type PermisoMaster  = { posicion: number; titulo: string; grupo: 'GENERAL' | 'ADMIN' | 'RRHH' };
export type MenuMasterItem = { posicion: number; titulo: string; modulo: 1 | 2 };

export type Talonario = {
  idtalonario: number;
  vencimiento: string | null;
  desde: number | null;
  hasta: number | null;
  sucursal: string | null;
};
export type SucursalLocal = { idsucursal: number; nombre: string };
export type TipoMesero    = { idtipo_mesero: number; descripcion: string };
export type Vendedor  = { idvendedor: number; nombre: string; apellido: string };
export type PlanVenta = { idplanventa: number; descripcion: string };
export type Condicion = { idcondicion: number; descripcion: string };
export type DepositoCatalogo = { iddeposito: number; descripcion: string; idsucursal: number };

export type SucursalUsuarioItem = {
  idsucursal: number;
  nombre: string;
  habilitada: boolean;
  orden: number;
};

export type DepositoUsuarioItem = {
  iddeposito: number;
  descripcion: string;
  idsucursal: number;
  salida: boolean;
  entrada: boolean;
  ordenSalida: number;
  ordenEntrada: number;
};

export type Operacion = {
  id:          number;
  descripcion: string;
  efectos: { bd: string; accion: string; flag: string }[];
};

export type Configuracion = {
  ip:            string;
  server:        string | null;
  sys_cfg:       string | null;
  master:        string | null;
  user_bd:       string | null;
  legajo:        number | null;
  biometrico:    number | null;
  gastronomia:   number | null;
  maximo:        number | null;
  complementario:number | null;
  ruta_archivo:  string | null;
  version_nro:   string | null;
  autorizado:    string | null;
  contabilidad:    number | null;
  talento_humano:  number | null;
  crear_sin_rol:   number | null;
  clonar:          number | null;
  replicar:        number | null;
  temporizador_replicacion: number | null;
  retencion_replicacion_horas: number | null;
  metadata_ejecutado?: number | null;
};

export type EmpresaSystem = { idempresa: string; nombre: string; accesible: number };
export type EmpresaMaster = { idempresa: string; razonsocial: string; estado: number; idempresa_system: string | null };

export const ConfiguracionAPI = {
  listar:             ()          => api.get<Configuracion[]>('/configuracion').then((r) => r.data),
  obtener:            (ip:string) => api.get<Configuracion>(`/configuracion/${ip}`).then((r) => r.data),
  crear:              (data: any) => api.post('/configuracion', data).then((r) => r.data),
  actualizar:         (ip:string, data: any) => api.put(`/configuracion/${ip}`, data).then((r) => r.data),
  eliminar:           (ip:string) => api.delete(`/configuracion/${ip}`).then((r) => r.data),
  verificarAcceso:    ()          => api.get<{ autorizado: boolean }>('/configuracion/autorizado').then((r) => r.data),
  listarOperaciones:  ()          => api.get<Operacion[]>('/configuracion/operaciones').then((r) => r.data),
  flags:              ()          => api.get<ConfigFlags>('/configuracion/flags').then((r) => r.data),
  metadataEstado:     ()          => api.get<{ ejecutado: boolean }>('/configuracion/metadata').then((r) => r.data),
  metadataEjecutar:   ()          => api.post<MetadataResultado>('/configuracion/metadata/ejecutar').then((r) => r.data),
  empresas:           ()          => api.get<{ system: EmpresaSystem[]; master: EmpresaMaster[] }>('/configuracion/empresas').then((r) => r.data),
  setEmpresaAccesible:      (idempresa: string, accesible: number) => api.put(`/configuracion/empresas/system/${idempresa}`, { accesible }).then((r) => r.data),
  setEmpresaMasterMapping:  (idempresa: string, idempresa_system: string | null) => api.put(`/configuracion/empresas/master/${idempresa}`, { idempresa_system }).then((r) => r.data),
};

// ── Replicación ──────────────────────────────────────────────────────────
export type ReplicacionDestino = {
  idsucursal:     number;
  nombre:         string;
  servidor:       string | null;
  replica_master: boolean;
  activo:         boolean;
  pendiente:      number;
  procesando:     number;
  enviado:        number;
  error:          number;
  bloqueado:      number;
};

export type ReplicacionJob = {
  id:           number;
  iduser:       string;
  idsucursal:   number;
  operacion:    string;
  estado:       number;
  estado_label: string;
  intentos:     number;
  ultimo_error: string | null;
  fecha_alta:   string | null;
  fecha_proc:   string | null;
};

export const ReplicacionAPI = {
  estado: () => api.get<{ destinos: ReplicacionDestino[] }>('/replicacion/estado').then((r) => r.data),
  cola:   (p: { idsucursal?: number; estado?: number } = {}) =>
    api.get<ReplicacionJob[]>('/replicacion/cola', { params: p }).then((r) => r.data),
  reintentar:        (id: number) => api.post(`/replicacion/cola/${id}/reintentar`).then((r) => r.data),
  reintentarDestino: (idsucursal?: number) =>
    api.post('/replicacion/reintentar-destino', { idsucursal }).then((r) => r.data),
  replicarUsuario:   (iduser: string, idsucursal?: number) =>
    api.post<{ ok: boolean; encolados: number }>(`/replicacion/usuario/${iduser}`, { idsucursal }).then((r) => r.data),
};

export type MetadataResultado = {
  ok: boolean;
  detalle: {
    permisos_generales: number;
    permisos_pdv:       number;
    tipo_usuario:       number;
    tipo_operacion:     number;
    /** Usuarios heredados sin rol (idtipo_usuario NULL) normalizados a -1 "Sin Asignación" */
    usuarios_sin_rol?:  number;
  };
};

export type ConfigFlags = {
  ip:             string;
  legajo:         boolean;
  biometrico:     boolean;
  gastronomia:    boolean;
  contabilidad:   boolean;
  talento_humano: boolean;
  complementario: boolean;
  crear_sin_rol:  boolean;
  clonar:         boolean;
  replicar:       boolean;
};

// ── Reportes ─────────────────────────────────────────────────────────────
export type FichaSucursal = { idsucursal: number; orden: number; nombre: string };
export type FichaDeposito = { iddeposito: number; orden: number; descripcion: string; idsucursal: number | null };

export type FichaUsuario = {
  usuario: Usuario & {
    idempresa?: string | null;
    control?: number | null;
    exclusion?: number | null;
    perfil_descripcion?: string | null;
  };
  complemento: Complemento | null;
  sucursales: FichaSucursal[];
  depositos:  { salida: FichaDeposito[]; entrada: FichaDeposito[] };
  accesos:    Accesos;
  conceptos:  ConceptosAccesos;
  vinculos: {
    legajo: {
      idpersona: number; nombre: string; apellido: string; nrodocumento: string;
      idcargo: number | null; iduser_system: string | null; cargo_estado: number | null;
    } | null;
    mesero: {
      idmesero: number; nombre: string; nrodocumento: string;
      idsucursal: number | null; estado: number | null; idtipo_mesero: number | null;
    } | null;
  };
  historialReciente: HistorialRow[];
  historialTotal:    number;
  generadoEn:        string;
};

export type FichaRol = {
  rol: {
    idperfil:    number;
    descripcion: string;
    iduser:      string;
    tipo:        number;
    estado:      number;
    master:      number;
    edicion_rol: number;
  };
  accesos:           Accesos;
  conceptos:         ConceptosAccesos;
  usuariosAsignados: RolUsuario[];
  generadoEn:        string;
};

export const ReportesAPI = {
  fichaUsuario: (iduser: string) =>
    api.get<FichaUsuario>(`/reportes/usuario/${iduser}`).then((r) => r.data),
  fichaRol: (idperfil: number | string) =>
    api.get<FichaRol>(`/reportes/rol/${idperfil}`).then((r) => r.data),
};

export type AuditoriaParams = {
  usuario?: string;
  idoperacion?: number | '';
  autorizacion?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  pageSize?: number;
};

export const AuditoriaAPI = {
  listar: (params: AuditoriaParams) =>
    api
      .get<HistorialPage>('/auditoria', {
        params: Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== '' && v != null),
        ),
      })
      .then((r) => r.data),
};
