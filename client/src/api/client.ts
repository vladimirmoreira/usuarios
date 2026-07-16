import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Redirige al login limpiando la sesión (con mensaje opcional para mostrar). */
function forzarLogin(mensaje?: string) {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  if (mensaje) sessionStorage.setItem('authMsg', mensaje);
  if (location.pathname !== '/login') location.href = '/login';
}

// ── Refresh de accessToken vencido ───────────────────────────────────────────
// El accessToken vive 15 min; en vez de expulsar al usuario al primer 401,
// intentamos renovarlo con el refreshToken (7 días) y reintentar la petición.
let refreshing: Promise<string> | null = null;

async function renovarToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('sin refresh token');
  // axios "pelado" (sin interceptores) para evitar recursión de 401.
  const r = await axios.post<{ accessToken: string }>(
    `${baseURL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
  const nuevo = r.data.accessToken;
  localStorage.setItem('accessToken', nuevo);
  return nuevo;
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = err.response?.status;
    const url = original?.url || '';

    // Solo intentamos refrescar en 401, una sola vez por petición, y nunca
    // para las propias rutas de auth (evita bucles login/refresh).
    const esRutaAuth = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !esRutaAuth) {
      original._retry = true;
      try {
        // Un único refresh compartido por todas las peticiones concurrentes.
        refreshing = refreshing ?? renovarToken().finally(() => { refreshing = null; });
        const nuevo = await refreshing;
        original.headers.Authorization = `Bearer ${nuevo}`;
        return api(original);
      } catch {
        forzarLogin();
        return Promise.reject(err);
      }
    }

    if (status === 401) forzarLogin();
    // Fuera de la franja horaria: la sesión se corta y se vuelve al login con aviso.
    if (status === 403 && (err.response?.data as any)?.code === 'FUERA_HORARIO') {
      forzarLogin((err.response?.data as any)?.error || 'Fuera del horario permitido.');
    }
    return Promise.reject(err);
  },
);

export default api;
