import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { queryClient, apiRequest } from "./queryClient";

export type AuthUser = {
  id: number;
  email: string;
  username: string;
  fullName: string;
  role: "teacher" | "student";
  avatarColor: string;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  login: (u: AuthUser) => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On load, ask the server who we are. If the session cookie is still valid
  // the user stays signed in across refreshes; otherwise /me returns 401.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/auth/me");
        const me = (await res.json()) as AuthUser;
        if (!cancelled && me && typeof me.id === "number") setUser(me);
      } catch {
        // Not signed in.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The server has already set the session cookie by the time this is called.
  const login = (u: AuthUser) => {
    setUser(u);
    queryClient.clear();
  };
  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      // Clear local state even if the request fails.
    }
    setUser(null);
    queryClient.clear();
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
