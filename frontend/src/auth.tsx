import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokenStore, type User } from "./api";

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (kind: "login" | "register", email: string, password: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); setLoading(false); return; }
    try { setUser(await api<User>("/auth/me")); }
    catch { tokenStore.clear(); setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const finish = (res: { token: string; user: User }) => { tokenStore.set(res.token); setUser(res.user); };

  const value: AuthState = {
    user, loading, refresh, setUser,
    signIn: async (kind, email, password) => finish(await api(`/auth/${kind}`, { method: "POST", json: { email, password } })),
    continueAsGuest: async () => finish(await api("/auth/guest", { method: "POST" })),
    signOut: () => { tokenStore.clear(); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
