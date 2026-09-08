import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { apiRequest, queryClient, setAuthToken, setUnauthorizedHandler, ApiError } from "./queryClient";
import type { Company, Plan, Subscription } from "@shared/schema";

export type SessionUser = {
  id: number;
  companyId: number;
  name: string;
  email: string;
  role: string;
  employeeId: number | null;
  customerId: number | null;
  active: number;
};

type AuthState = {
  user: SessionUser | null;
  company: Company | null;
  plan: Plan | null;
  subscription: Subscription | null;
};

type AuthContextValue = AuthState & {
  features: string[];
  hasFeature: (feature: string) => boolean;
  hasAI: boolean;
  isPlatformAdmin: boolean;
  /** Det firma, brugeren arbejder i. Kun platformadmins kan skifte væk fra deres eget. */
  companyId: number;
  switchCompany: (id: number) => void;
  login: (email: string, password: string, code?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY: AuthState = { user: null, company: null, plan: null, subscription: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(EMPTY);
  const [viewCompanyId, setViewCompanyId] = useState<number | null>(null);

  const clear = useCallback(() => {
    setAuthToken(null);
    setState(EMPTY);
    setViewCompanyId(null);
    queryClient.clear();
  }, []);

  // Hvis backenden afviser tokenet (udløbet session), ryddes klienten automatisk.
  useEffect(() => {
    setUnauthorizedHandler(clear);
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  const login = useCallback(async (email: string, password: string, code?: string) => {
    // Uden token endnu — apiRequest sender blot ingen Authorization-header.
    const res = await apiRequest("POST", "/api/auth/login", { email, password, ...(code ? { code } : {}) });
    const data = await res.json();
    setAuthToken(data.token);
    queryClient.clear();
    setViewCompanyId(null);
    setState({
      user: data.user,
      company: data.company ?? null,
      plan: data.plan ?? null,
      subscription: data.subscription ?? null,
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      const data = await res.json();
      setState({
        user: data.user,
        company: data.company ?? null,
        plan: data.plan ?? null,
        subscription: data.subscription ?? null,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) clear();
      else throw err;
    }
  }, [clear]);

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      // Selv hvis kaldet fejler, skal den lokale session ryddes.
    }
    clear();
  }, [clear]);

  const features = useMemo(() => {
    if (!state.plan?.features) return [];
    try {
      const parsed = JSON.parse(state.plan.features);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }, [state.plan]);

  const isPlatformAdmin = state.user?.role === "platform_admin";
  const hasAI = isPlatformAdmin || ((state.company as any)?.aiEnabled === 1);

  const switchCompany = useCallback((id: number) => {
    setViewCompanyId(id);
    queryClient.clear();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    features,
    hasAI,
    // Platformadmins har adgang til alt.
    hasFeature: (f: string) => isPlatformAdmin || features.includes(f),
    isPlatformAdmin,
    companyId: (isPlatformAdmin ? viewCompanyId : null) ?? state.user?.companyId ?? 0,
    switchCompany,
    login,
    logout,
    refresh,
  }), [state, features, isPlatformAdmin, viewCompanyId, switchCompany, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth skal bruges inden i AuthProvider");
  return ctx;
}
