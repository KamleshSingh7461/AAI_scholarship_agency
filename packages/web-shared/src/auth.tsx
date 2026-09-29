'use client';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, refreshAccessToken, setAccessToken } from './api';
import { PageLoader } from './ui';

export interface SessionUser {
  id: string;
  phone: string;
  email: string | null;
  fullName: string | null;
  role: string;
  status: string;
  universityId: string | null;
}

interface AuthState {
  status: 'loading' | 'authenticated' | 'anonymous';
  user: SessionUser | null;
  setSession: (accessToken: string, user: SessionUser) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/** Restores the session from the httpOnly refresh cookie on load and keeps the access token fresh. */
export function AuthProvider({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await refreshAccessToken();
      if (cancelled) return;
      if (!token) {
        setStatus('anonymous');
        return;
      }
      try {
        const me = await api<SessionUser>('/auth/me');
        if (allowedRoles && !allowedRoles.includes(me.role)) {
          setAccessToken(null);
          setStatus('anonymous');
          return;
        }
        setUser(me);
        setStatus('authenticated');
      } catch {
        setStatus('anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowedRoles]);

  // Proactively refresh a minute before the 15-minute access token expires.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const t = setInterval(() => void refreshAccessToken(), 13 * 60_000);
    return () => clearInterval(t);
  }, [status]);

  const setSession = useCallback((accessToken: string, u: SessionUser) => {
    setAccessToken(accessToken);
    setUser(u);
    setStatus('authenticated');
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await api<SessionUser>('/auth/me'));
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'x-aci-client': 'web' } }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(() => ({ status, user, setSession, refreshUser, logout }), [status, user, setSession, refreshUser, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

/** Client-side guard: shows a loader while restoring the session, redirects to /login otherwise. */
export function RequireAuth({ children, loginPath = '/login' }: { children: ReactNode; loginPath?: string }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status === 'anonymous') router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname, loginPath]);
  if (status !== 'authenticated') return <PageLoader label={status === 'loading' ? 'Checking your session…' : 'Redirecting to login…'} />;
  return <>{children}</>;
}
