import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import LoginPage from './features/login/LoginPage';
import RecuperarPage from './features/recuperar/RecuperarPage';
import UsuariosPage from './features/usuarios/UsuariosPage';
import InactividadPage from './features/usuarios/InactividadPage';
import AccesosPage from './features/accesos/AccesosPage';
import RoleAccesosPage from './features/accesos/RoleAccesosPage';
import RolesPage from './features/roles/RolesPage';
import ConfiguracionPage from './features/configuracion/ConfiguracionPage';
import ReplicacionPage from './features/replicacion/ReplicacionPage';
import DocumentacionPage from './features/documentacion/DocumentacionPage';
import TutorialPage from './features/tutorial/TutorialPage';
import ReportesPage from './features/reportes/ReportesPage';
import AuditoriaPage from './features/auditoria/AuditoriaPage';
import AppLayout from './components/layout/AppLayout';

function Protected({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar" element={<RecuperarPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/usuarios" replace />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="usuarios/inactividad" element={<InactividadPage />} />
        <Route path="usuarios/:iduser/accesos" element={<AccesosPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="roles/:idperfil/accesos" element={<RoleAccesosPage />} />
        <Route path="auditoria" element={<AuditoriaPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
        <Route path="replicacion" element={<ReplicacionPage />} />
        <Route path="documentacion" element={<DocumentacionPage />} />
        <Route path="tutorial" element={<TutorialPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
