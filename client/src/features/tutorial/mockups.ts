/* Mockups SVG vectoriales para el Tutorial (escalan sin deformarse, tema claro tipo captura). */

const wrap = (h: number, inner: string) =>
  `<svg viewBox="0 0 640 ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block" font-family="system-ui,Segoe UI,Arial">${inner}</svg>`;

const card = (x: number, y: number, w: number, h: number, fill = '#ffffff') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="#e2e8f0"/>`;

const bar = (x: number, y: number, w: number, t: string) =>
  `<path d="M${x} ${y + 12} a12 12 0 0 1 12 -12 h${w - 24} a12 12 0 0 1 12 12 v26 h-${w} z" fill="#f8fafc"/>` +
  `<line x1="${x}" y1="${y + 38}" x2="${x + w}" y2="${y + 38}" stroke="#e2e8f0"/>` +
  `<text x="${x + 16}" y="${y + 25}" font-size="13" font-weight="700" fill="#0f172a">${t}</text>`;

const fld = (x: number, y: number, w: number, label: string, val: string, hi = false) =>
  `<text x="${x}" y="${y}" font-size="11" fill="#64748b">${label}</text>` +
  `<rect x="${x}" y="${y + 7}" width="${w}" height="30" rx="7" fill="${hi ? '#eef2ff' : '#ffffff'}" stroke="${hi ? '#4f46e5' : '#cbd5e1'}"/>` +
  `<text x="${x + 11}" y="${y + 27}" font-size="12.5" fill="${hi ? '#4f46e5' : '#0f172a'}">${val}</text>`;

const btn = (x: number, y: number, w: number, t: string, primary = false) =>
  `<rect x="${x}" y="${y}" width="${w}" height="30" rx="7" fill="${primary ? '#4f46e5' : '#ffffff'}" stroke="${primary ? '#4f46e5' : '#cbd5e1'}"/>` +
  `<text x="${x + w / 2}" y="${y + 20}" font-size="12" font-weight="${primary ? 600 : 400}" fill="${primary ? '#ffffff' : '#334155'}" text-anchor="middle">${t}</text>`;

const chip = (x: number, y: number, t: string, fill: string, fg: string) => {
  const w = 12 + t.length * 6.2;
  return `<rect x="${x}" y="${y}" width="${w}" height="18" rx="9" fill="${fill}"/>` +
    `<text x="${x + w / 2}" y="${y + 12.5}" font-size="10.5" font-weight="600" fill="${fg}" text-anchor="middle">${t}</text>`;
};

const co = (x: number, y: number, n: string) =>
  `<circle cx="${x}" cy="${y}" r="10" fill="#f59e0b"/><text x="${x}" y="${y + 4}" font-size="12" font-weight="700" fill="#fff" text-anchor="middle">${n}</text>`;

/* Botón de acción de grilla: cuadradito + etiqueta debajo. */
const act = (x: number, y: number, label: string) =>
  `<rect x="${x}" y="${y}" width="26" height="26" rx="6" fill="#f8fafc" stroke="#cbd5e1"/>` +
  `<circle cx="${x + 13}" cy="${y + 13}" r="4.5" fill="#64748b"/>` +
  `<text x="${x + 13}" y="${y + 44}" font-size="10" fill="#334155" text-anchor="middle">${label}</text>`;

/* Menú lateral con el ítem activo resaltado. */
const sidebar = (activo: string) => {
  const items = ['Usuarios', 'Incidencias', 'Roles', 'Auditoría', 'Reportes', 'Configuración', 'Replicación', 'Tutorial'];
  let s = card(8, 8, 132, 300, '#ffffff');
  s += `<text x="24" y="34" font-size="12" font-weight="700" fill="#4f46e5">Accesos</text>`;
  items.forEach((it, i) => {
    const y = 52 + i * 30;
    const on = it === activo;
    if (on) s += `<rect x="14" y="${y}" width="120" height="24" rx="6" fill="#eef2ff"/>`;
    s += `<circle cx="26" cy="${y + 12}" r="3.5" fill="${on ? '#4f46e5' : '#94a3b8'}"/>`;
    s += `<text x="38" y="${y + 16}" font-size="11.5" font-weight="${on ? 600 : 400}" fill="${on ? '#4f46e5' : '#475569'}">${it}</text>`;
  });
  return s;
};

/* ── Mockups por sección ─────────────────────────────────────────────────── */

export const mLogin = wrap(300,
  card(200, 30, 240, 240) +
  `<circle cx="320" cy="72" r="18" fill="#4f46e5"/>` +
  `<rect x="313" y="71" width="14" height="10" rx="2" fill="#fff"/>` +
  `<path d="M316 71 v-3 a4 4 0 0 1 8 0 v3" fill="none" stroke="#fff" stroke-width="2"/>` +
  `<text x="320" y="112" font-size="15" font-weight="700" fill="#0f172a" text-anchor="middle">Ingresar</text>` +
  fld(224, 138, 192, 'Usuario', 'ADMIN') +
  fld(224, 186, 192, 'Contraseña', '••••••••') +
  btn(224, 232, 192, 'Ingresar', true));

export const mPanel = wrap(320,
  sidebar('Usuarios') +
  card(150, 8, 482, 300) +
  bar(150, 8, 482, 'Usuarios') +
  btn(166, 56, 70, 'Nuevo', true) + btn(244, 56, 74, 'Importar') + btn(326, 56, 74, 'Exportar') +
  `<rect x="166" y="98" width="450" height="26" fill="#f8fafc"/>` +
  `<text x="176" y="115" font-size="10.5" font-weight="700" fill="#64748b">USUARIO</text>` +
  `<text x="286" y="115" font-size="10.5" font-weight="700" fill="#64748b">NOMBRE</text>` +
  `<text x="396" y="115" font-size="10.5" font-weight="700" fill="#64748b">PERFIL</text>` +
  `<text x="606" y="115" font-size="10.5" font-weight="700" fill="#64748b" text-anchor="end">ACCIONES</text>` +
  [0, 1, 2].map((i) => {
    const y = 132 + i * 34;
    const u = ['USINROL', 'UROLVENTAS', 'UROLPRODUC'][i];
    const p = ['Sin Rol', 'Encargado de Ventas', 'Producción'][i];
    let r = `<text x="176" y="${y + 6}" font-size="11.5" fill="#0f172a">${u}</text>`;
    r += `<text x="286" y="${y + 6}" font-size="11.5" fill="#334155">Usuario</text>`;
    r += `<text x="396" y="${y + 6}" font-size="11.5" fill="#334155">${p}</text>`;
    for (let k = 0; k < 5; k++) r += `<rect x="${520 + k * 20}" y="${y - 8}" width="16" height="16" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/>`;
    r += `<line x1="166" y1="${y + 16}" x2="616" y2="${y + 16}" stroke="#eef2f5"/>`;
    return r;
  }).join('') +
  co(606, 111, '1'));

export const mAccionesUsuario = wrap(120,
  card(8, 8, 624, 104) +
  ['Accesos', 'Modificar', 'Reiniciar', 'Historial', 'Sucursal', 'Legajo', 'Reactivar', 'Baja']
    .map((l, i) => act(28 + i * 74, 30, l)).join(''));

export const mRoles = wrap(260,
  card(8, 8, 624, 244) +
  bar(8, 8, 624, 'Roles') +
  btn(24, 56, 86, 'Nuevo rol', true) +
  `<rect x="24" y="98" width="592" height="26" fill="#f8fafc"/>` +
  `<text x="36" y="115" font-size="10.5" font-weight="700" fill="#64748b">DESCRIPCIÓN</text>` +
  `<text x="300" y="115" font-size="10.5" font-weight="700" fill="#64748b">ESTADO</text>` +
  `<text x="606" y="115" font-size="10.5" font-weight="700" fill="#64748b" text-anchor="end">ACCIONES</text>` +
  [0, 1].map((i) => {
    const y = 138 + i * 34;
    const d = ['Encargado de Ventas', 'Producción'][i];
    let r = `<text x="36" y="${y}" font-size="11.5" fill="#0f172a">${d}</text>`;
    r += chip(300, y - 12, 'Activo', '#dcfce7', '#166534');
    ['Permisos', 'Editar', 'Baja'].forEach((_, k) => { r += `<rect x="${520 + k * 30}" y="${y - 14}" width="24" height="20" rx="5" fill="#f1f5f9" stroke="#cbd5e1"/>`; });
    return r;
  }).join('') +
  `<text x="520" y="212" font-size="9.5" fill="#334155">Permisos</text><text x="556" y="212" font-size="9.5" fill="#334155">Editar</text><text x="592" y="212" font-size="9.5" fill="#334155">Baja</text>`);

export const mImportacion = wrap(300,
  card(60, 20, 520, 260) +
  bar(60, 20, 520, 'Importar usuarios') +
  `<text x="80" y="86" font-size="11.5" fill="#64748b">Pegá o subí (columnas: nombre, apellido, documento, perfil, idsucursal)</text>` +
  `<rect x="80" y="100" width="480" height="24" fill="#f8fafc"/>` +
  ['nombre', 'apellido', 'documento', 'perfil', 'idsucursal'].map((h, i) => `<text x="${92 + i * 96}" y="116" font-size="10" font-weight="700" fill="#64748b">${h}</text>`).join('') +
  [['Usuario', 'Rolventas', '90000002', '7', '1', true], ['Ana', 'Gomez', '123', 'XXX', '9', false]].map((row, i) => {
    const y = 140 + i * 26;
    const ok = row[5] as boolean;
    let r = (row.slice(0, 5) as string[]).map((c, k) => `<text x="${92 + k * 96}" y="${y}" font-size="10.5" fill="#334155">${c}</text>`).join('');
    r += chip(500, y - 12, ok ? 'OK' : 'Error', ok ? '#dcfce7' : '#fee2e2', ok ? '#166534' : '#991b1b');
    return r;
  }).join('') +
  `<text x="80" y="212" font-size="10.5" fill="#991b1b">Fila 2: perfil "XXX" no existe · idsucursal 9 inactiva</text>` +
  btn(400, 236, 76, 'Cancelar') + btn(486, 236, 76, 'Importar', true));

export const mAuditoria = wrap(280,
  card(8, 8, 624, 264) +
  bar(8, 8, 624, 'Auditoría') +
  fld(24, 58, 150, 'Usuario', 'UROLVENTAS') + fld(190, 58, 150, 'Operación', 'Todas', true) + fld(356, 58, 120, 'Desde', '01/07') + btn(492, 65, 60, 'Filtrar', true) +
  `<rect x="24" y="118" width="592" height="24" fill="#f8fafc"/>` +
  ['FECHA', 'USUARIO', 'OPERACIÓN', 'OBSERVACIÓN'].map((h, i) => `<text x="${36 + [0, 110, 220, 360][i]}" y="134" font-size="10" font-weight="700" fill="#64748b">${h}</text>`).join('') +
  [['16/07', 'UROLVENTAS', 'Alta de Usuario', 'Perfil=7 Suc=1'], ['16/07', 'ADMIN', 'Inicio de Sesión', 'empresa=1 ip=…']].map((row, i) => {
    const y = 160 + i * 26;
    return row.map((c, k) => `<text x="${36 + [0, 110, 220, 360][k]}" y="${y}" font-size="10.5" fill="#334155">${c}</text>`).join('') + `<line x1="24" y1="${y + 8}" x2="616" y2="${y + 8}" stroke="#eef2f5"/>`;
  }).join(''));

export const mReportes = wrap(280,
  card(120, 16, 400, 250) +
  bar(120, 16, 400, 'Ficha de Usuario') +
  `<circle cx="160" cy="86" r="20" fill="#eef2ff"/><text x="160" y="91" font-size="13" font-weight="700" fill="#4f46e5" text-anchor="middle">UV</text>` +
  `<text x="192" y="80" font-size="14" font-weight="700" fill="#0f172a">Usuario Rolventas</text>` +
  `<text x="192" y="98" font-size="11.5" fill="#64748b">UROLVENTAS · Encargado de Ventas</text>` +
  `<line x1="140" y1="118" x2="500" y2="118" stroke="#e2e8f0"/>` +
  ['Documento: 90000002', 'Sucursal: Casa Central', 'Permisos: 12 activos', 'Estado: Activo'].map((t, i) => `<text x="140" y="${142 + i * 22}" font-size="11.5" fill="#334155">${t}</text>`).join('') +
  btn(392, 226, 110, 'Imprimir / PDF', true));

export const mClonacion = wrap(150,
  card(90, 16, 460, 118) +
  `<text x="110" y="46" font-size="12" font-weight="700" fill="#0f172a">Clonar accesos a empresa</text>` +
  fld(110, 58, 250, 'Empresa destino', 'Sucursal Centro (#3)', true) +
  btn(374, 65, 90, 'Clonar', true) +
  `<text x="110" y="122" font-size="10.5" fill="#64748b">Copia permisos y menú (no sucursal ni depósitos).</text>`);

export const mConfiguracion = wrap(240,
  card(8, 8, 624, 224) +
  bar(8, 8, 624, 'Configuración') +
  ['Configuración', 'Empresas', 'Metadatos'].map((t, i) => `<text x="${28 + i * 110}" y="70" font-size="11.5" font-weight="${i === 0 ? 700 : 400}" fill="${i === 0 ? '#4f46e5' : '#64748b'}">${t}</text>`).join('') +
  `<line x1="24" y1="80" x2="102" y2="80" stroke="#4f46e5" stroke-width="2"/>` +
  [['Legajo', true], ['Gastronomía', true], ['Clonar', true], ['Replicar', true], ['Crear Sin Rol', true], ['Biométrico', false]].map((f, i) => {
    const x = 28 + (i % 3) * 200; const y = 104 + Math.floor(i / 3) * 34;
    const on = f[1] as boolean;
    return `<rect x="${x}" y="${y}" width="30" height="17" rx="8.5" fill="${on ? '#4f46e5' : '#cbd5e1'}"/><circle cx="${on ? x + 21 : x + 9}" cy="${y + 8.5}" r="6" fill="#fff"/><text x="${x + 40}" y="${y + 13}" font-size="11.5" fill="#334155">${f[0]}</text>`;
  }).join('') +
  fld(28, 178, 180, 'Temporizador replicación (min)', '15') + fld(228, 178, 180, 'Retención exitosos (horas)', '48'));

export const mReplicacion = wrap(300,
  card(8, 8, 624, 284) +
  bar(8, 8, 624, 'Replicación') +
  `<rect x="24" y="52" width="592" height="46" rx="8" fill="#fffbeb" stroke="#fde68a"/>` +
  `<text x="36" y="72" font-size="11" font-weight="700" fill="#92400e">Roles pendientes de propagar</text>` +
  `<text x="36" y="90" font-size="11" fill="#78716c">Encargado de Ventas · 62 usuarios</text>` +
  btn(520, 62, 80, 'Replicar', true) +
  `<rect x="24" y="114" width="592" height="24" fill="#f8fafc"/>` +
  `<text x="36" y="130" font-size="10" font-weight="700" fill="#64748b">DESTINO</text>` +
  `<text x="260" y="130" font-size="10" font-weight="700" fill="#64748b">ESTADOS DE LA COLA</text>` +
  [['Sucursal 2 · Centro', ['Encolado 0', 'Enviado 40', 'Error 0', 'Bloq. 2']], ['Sucursal 3 · Norte', ['Encolado 5', 'Enviado 12', 'Error 1', 'Bloq. 0']]].map((row, i) => {
    const y = 156 + i * 40;
    let r = `<text x="36" y="${y}" font-size="11.5" fill="#0f172a">${row[0]}</text>`;
    const states = row[1] as string[];
    const cols = [['#fef3c7', '#92400e'], ['#dcfce7', '#166534'], ['#fee2e2', '#991b1b'], ['#f3e8ff', '#6b21a8']];
    let x = 260;
    states.forEach((st, k) => { r += chip(x, y - 12, st, cols[k][0], cols[k][1]); x += 12 + st.length * 6.2 + 8; });
    r += `<line x1="24" y1="${y + 14}" x2="616" y2="${y + 14}" stroke="#eef2f5"/>`;
    return r;
  }).join(''));
