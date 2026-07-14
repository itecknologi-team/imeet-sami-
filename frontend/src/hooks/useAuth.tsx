import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as api from "../services/api";

const ACCESS_TOKEN_KEY = "imeet_access_token";
const REFRESH_TOKEN_KEY = "imeet_refresh_token";

interface AuthContextValue {
  user: api.MeResponse | null;
  status: "loading" | "authenticated" | "unauthenticated";
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<api.MeResponse | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  useEffect(() => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!accessToken) {
      setStatus("unauthenticated");
      return;
    }
    api
      .getMe(accessToken)
      .then((me) => {
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setStatus("unauthenticated");
      });
  }, []);

  function storeSession(auth: api.AuthResponse, me: api.MeResponse) {
    localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
    setUser(me);
    setStatus("authenticated");
  }

  async function signup(name: string, email: string, password: string) {
    const auth = await api.signup(name, email, password);
    storeSession(auth, { ...auth.user, avatarUrl: null });
  }

  async function login(email: string, password: string) {
    const auth = await api.login(email, password);
    storeSession(auth, { ...auth.user, avatarUrl: null });
  }

  async function logout() {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      await api.logout(refreshToken).catch(() => undefined);
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setUser(null);
    setStatus("unauthenticated");
  }

  return (
    <AuthContext.Provider value={{ user, status, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
