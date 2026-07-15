import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Users, ShieldCheck, UserCog, Settings, UserMinus, Sun, Moon, BarChart2, ScrollText, Radio } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../auth/ThemeContext';
import { ConfiguracionAPI } from '../../api/endpoints';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const nav = useNavigate();

  const accesoQ = useQuery({
    queryKey: ['configuracion', 'autorizado'],
    queryFn: ConfiguracionAPI.verificarAcceso,
    staleTime: 5 * 60_000,
  });
  const puedeVerConfig = accesoQ.data?.autorizado ?? false;

  // Menú Replicación: visible solo si el flag REPLICAR está activo y el usuario es autorizado.
  const flagsQ = useQuery({
    queryKey: ['cfg-flags'],
    queryFn: ConfiguracionAPI.flags,
    staleTime: 5 * 60_000,
  });
  const puedeVerReplicacion = puedeVerConfig && (flagsQ.data?.replicar ?? false);

  const onLogout = () => { logout(); nav('/login'); };

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white px-3 py-5 dark:border-zinc-700 dark:bg-zinc-900 md:block">
        <Link to="/" className="mb-6 flex items-center gap-2 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Accesos</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Módulo Usuarios</div>
          </div>
        </Link>

        <nav className="space-y-1">
          <NavLink
            end
            to="/usuarios"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`
            }
          >
            <Users className="h-4 w-4" /> Usuarios
          </NavLink>
          <NavLink
            to="/usuarios/inactividad"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`
            }
          >
            <UserMinus className="h-4 w-4" /> Incidencias
          </NavLink>
          <NavLink
            to="/roles"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`
            }
          >
            <UserCog className="h-4 w-4" /> Roles
          </NavLink>
          <NavLink
            to="/auditoria"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`
            }
          >
            <ScrollText className="h-4 w-4" /> Auditoría
          </NavLink>
          <NavLink
            to="/reportes"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`
            }
          >
            <BarChart2 className="h-4 w-4" /> Reportes
          </NavLink>
          {puedeVerConfig && (
            <NavLink
              to="/configuracion"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`
              }
            >
              <Settings className="h-4 w-4" /> Configuración
            </NavLink>
          )}
          {puedeVerReplicacion && (
            <NavLink
              to="/replicacion"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`
              }
            >
              <Radio className="h-4 w-4" /> Replicación
            </NavLink>
          )}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-700 dark:bg-zinc-900">
          <h1 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Panel de Control de Usuario</h1>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {user?.nombre} {user?.apellido}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{user?.iduser}</div>
            </div>
            <button
              className="btn-ghost"
              onClick={toggle}
              title={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button className="btn-ghost" onClick={onLogout} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 bg-zinc-50 p-6 dark:bg-zinc-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
