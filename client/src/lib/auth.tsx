import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setCurrentUserId, getPersistedUserId, queryClient, apiRequest } from "./queryClient";

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
  logout: () => void;
};

const Ctx = createContext<AuthCtx>({ user: null, loading: true, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, try to restore a still-valid persisted session so a page refresh
  // keeps the user signed in (within the session TTL).
  useEffect(() => {
    const persistedId = getPersistedUserId();
    if (persistedId == null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/auth/me");
        const me = (await res.json()) as AuthUser;
        if (!cancelled && me && typeof me.id === "number") {
          setCurrentUserId(me.id);
          setUser(me);
        }
      } catch {
        // Session no longer valid on the server — clear it.
        setCurrentUserId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = (u: AuthUser) => {
    setCurrentUserId(u.id);
    setUser(u);
    queryClient.clear();
  };
  const logout = () => {
    setCurrentUserId(null);
    setUser(null);
    queryClient.clear();
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
