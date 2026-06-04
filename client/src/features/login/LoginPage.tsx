import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthAPI } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [iduser, setIduser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await AuthAPI.login(iduser.trim(), pass);
      login(res.accessToken, res.refreshToken, res.usuario);
      nav('/usuarios');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-zinc-100 to-brand-100 p-4 dark:from-zinc-950 dark:to-zinc-900">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
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
    </div>
  );
}
