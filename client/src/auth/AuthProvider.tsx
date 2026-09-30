import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ApiError, getMe } from "../api";
import type { AuthCredentials, DeskUser } from "../types";

interface AuthContextValue {
  token: string | null;
  user: DeskUser | null;
  loading: boolean;
  sessionExpired: boolean;
  sessionError: Error | null;
  signIn: (credentials: AuthCredentials) => void;
  signOut: () => void;
  retryMe: () => void;
  clearSessionMessage: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSavedUser(): DeskUser | null {
  try {
    const value = localStorage.getItem("omni_user");
    return value ? JSON.parse(value) as DeskUser : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("omni_token"));
  const [savedUser, setSavedUser] = useState<DeskUser | null>(readSavedUser);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: () => getMe(token!),
    enabled: !!token,
    staleTime: 60_000,
    retry: false,
  });

  const signOut = useCallback(() => {
    localStorage.removeItem("omni_token");
    localStorage.removeItem("omni_user");
    setToken(null);
    setSavedUser(null);
    setSessionExpired(false);
    queryClient.clear();
  }, [queryClient]);

  const expireSession = useCallback(() => {
    localStorage.removeItem("omni_token");
    localStorage.removeItem("omni_user");
    setToken(null);
    setSavedUser(null);
    setSessionExpired(true);
    queryClient.removeQueries({ queryKey: ["auth"] });
  }, [queryClient]);

  useEffect(() => {
    const onUnauthorized = () => expireSession();
    window.addEventListener("omni:unauthorized", onUnauthorized);
    return () => window.removeEventListener("omni:unauthorized", onUnauthorized);
  }, [expireSession]);

  useEffect(() => {
    if (meQuery.error instanceof ApiError && meQuery.error.status === 401) expireSession();
  }, [expireSession, meQuery.error]);

  const signIn = useCallback((credentials: AuthCredentials) => {
    localStorage.setItem("omni_token", credentials.token);
    localStorage.setItem("omni_user", JSON.stringify(credentials.user));
    setToken(credentials.token);
    setSavedUser(credentials.user);
    setSessionExpired(false);
    queryClient.setQueryData(["auth", "me", credentials.token], credentials.user);
  }, [queryClient]);

  const clearSessionMessage = useCallback(() => setSessionExpired(false), []);
  const value = useMemo<AuthContextValue>(() => ({
    token,
    user: meQuery.data ?? savedUser,
    loading: !!token && meQuery.isPending,
    sessionExpired,
    sessionError: meQuery.error instanceof Error ? meQuery.error : null,
    signIn,
    signOut,
    retryMe: () => { void meQuery.refetch(); },
    clearSessionMessage,
  }), [token, meQuery.data, meQuery.isPending, meQuery.error, savedUser, sessionExpired, signIn, signOut, clearSessionMessage]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.token) {
    return <Navigate to="/login" replace state={{ from: location, sessionExpired: auth.sessionExpired }} />;
  }
  if (auth.loading) return <div className="app-loading"><span className="spinner" />Checking your workspace…</div>;
  if (auth.sessionError && !(auth.sessionError instanceof ApiError && auth.sessionError.status === 401)) {
    return (
      <div className="app-loading">
        <section className="state-card">
          <h1>Can’t reach your workspace</h1>
          <p>{auth.sessionError.message}</p>
          <button className="button button-primary" onClick={auth.retryMe}>Try again</button>
        </section>
      </div>
    );
  }
  if (!auth.user) return <div className="app-loading"><span className="spinner" />Loading your workspace…</div>;
  return <Outlet />;
}
