import { FormEvent, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2, Building2, ArrowLeft } from 'lucide-react';
import toast from '../../lib/notify';
import { AuthAPI, type EmpresaOpcion } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [iduser, setIduser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  // Fase 2 (multi-empresa): si el usuario tiene >1 empresa accesible, se muestra el combo.
  const [empresas, setEmpresas] = useState<EmpresaOpcion[] | null>(null);
  const [idempresa, setIdempresa] = useState('');

  // Aviso cuando la sesión se cortó (p. ej. fuera de la franja horaria).
  useEffect(() => {
    const m = sessionStorage.getItem('authMsg');
    if (m) { toast.error(m); sessionStorage.removeItem('authMsg'); }
  }, []);

  const doLogin = async (emp?: string) => {
    setLoading(true);
    try {
      const res = await AuthAPI.login(iduser.trim(), pass, emp);
      if ('multiEmpresa' in res) {
        setEmpresas(res.empresas);
        setIdempresa(res.empresas[0]?.idempresa ?? '');
        return; // esperar elección de empresa
      }
      login(res.accessToken, res.refreshToken, res.usuario);
      nav('/usuarios');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const submitCredenciales = (e: FormEvent) => { e.preventDefault(); doLogin(); };
  const submitEmpresa = (e: FormEvent) => { e.preventDefault(); if (idempresa) doLogin(idempresa); };
  const volver = () => { setEmpresas(null); setIdempresa(''); };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-zinc-100 to-brand-100 p-4 dark:from-zinc-950 dark:to-zinc-900">
      {!empresas ? (
        <form onSubmit={submitCredenciales} className="card w-full max-w-sm p-6">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="mt-3 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Módulo Usuarios</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingresá tus credenciales</p>
          </div>

          <label className="label">Usuario</label>
          <input
            autoFocus
            value={iduser}
            onChange={(e) => setIduser(e.target.value)}
            className="input mt-1"
            maxLength={10}
            required
          />

          <label className="label mt-4 block">Contraseña</label>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="input mt-1"
            maxLength={20}
            required
          />

          <button className="btn-primary mt-6 w-full justify-center" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Ingresar
          </button>
        </form>
      ) : (
        <form onSubmit={submitEmpresa} className="card w-full max-w-sm p-6">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="mt-3 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Elegí la empresa</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              <strong>{iduser.trim().toUpperCase()}</strong> tiene acceso a varias empresas
            </p>
          </div>

          <label className="label">Empresa</label>
          <select
            autoFocus
            value={idempresa}
            onChange={(e) => setIdempresa(e.target.value)}
            className="input mt-1"
            required
          >
            {empresas.map((e) => (
              <option key={e.idempresa} value={e.idempresa}>{e.nombre} (#{e.idempresa})</option>
            ))}
          </select>

          <button className="btn-primary mt-6 w-full justify-center" disabled={loading || !idempresa}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Ingresar
          </button>
          <button
            type="button"
            onClick={volver}
            className="btn-ghost mt-2 w-full justify-center text-sm"
            disabled={loading}
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
        </form>
      )}
    </div>
  );
}
