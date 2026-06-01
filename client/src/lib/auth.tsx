import { createContext, useContext, useState, ReactNode } from "react";
import { setCurrentUserId, queryClient } from "./queryClient";

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
  login: (u: AuthUser) => void;
  logout: () => void;
};

const Ctx = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

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

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
