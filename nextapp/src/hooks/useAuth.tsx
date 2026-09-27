import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setToken } from "../api/client";

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organization_id: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<CurrentUser>("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{
      access_token: string;
      user_id: string;
      organization_id: string;
      name: string;
      role: string;
    }>("/api/auth/login", { email, password });
    setToken(res.access_token);
    setUser({
      id: res.user_id,
      email,
      name: res.name,
      role: res.role,
      organization_id: res.organization_id,
    });
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
