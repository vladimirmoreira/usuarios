import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type UserInfo = {
  iduser: string; nombre: string; apellido: string; idperfil: number;
  idempresa?: string; empresaNombre?: string;
} | null;

type AuthCtx = {
  token: string | null;
  user: UserInfo;
  login: (token: string, refresh: string, user: UserInfo) => void;
  logout: () => void;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [user, setUser] = useState<UserInfo>(() => {
    // Tolerar basura en localStorage ('undefined', JSON inválido) sin romper la app.
    try {
      const u = localStorage.getItem('userInfo');
      return u && u !== 'undefined' && u !== 'null' ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (token) localStorage.setItem('accessToken', token);
    else localStorage.removeItem('accessToken');
  }, [token]);

  return (
    <Ctx.Provider
      value={{
        token,
        user,
        login: (t, r, u) => {
          setToken(t);
          setUser(u);
          localStorage.setItem('accessToken', t);
          localStorage.setItem('refreshToken', r);
          localStorage.setItem('userInfo', JSON.stringify(u ?? null));
        },
        logout: () => {
          setToken(null);
          setUser(null);
          localStorage.clear();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
