/**
 * Browser API client. All calls go to same-origin `/api/v1/...` (each Next app proxies /api to the gateway),
 * so the httpOnly refresh cookie is first-party and never readable by JS.
 * The short-lived access token lives only in memory; a 401 triggers one shared refresh attempt.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
    readonly body: any,
  ) {
    super(message);
  }
}

type Listener = (token: string | null) => void;

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
const listeners = new Set<Listener>();

export function setAccessToken(t: string | null) {
  accessToken = t;
  listeners.forEach((l) => l(t));
}
export function getAccessToken() {
  return accessToken;
}
export function onTokenChange(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

async function parse(res: Response) {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/** Rotates the refresh cookie and returns a fresh access token (single-flight across concurrent calls). */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: { 'x-aci-client': 'web' } });
        if (!res.ok) {
          setAccessToken(null);
          return null;
        }
        const body = await res.json();
        setAccessToken(body.accessToken);
        return body.accessToken as string;
      } catch {
        return null;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
  }
  return refreshing;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

export async function api<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(path.startsWith('/api') ? path : `/api/v1${path.startsWith('/') ? '' : '/'}${path}`, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));

  const doFetch = (token: string | null) =>
    fetch(url, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      credentials: 'same-origin',
      signal: opts.signal,
      headers: {
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        'x-aci-client': 'web',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

  let res = await doFetch(accessToken);
  if (res.status === 401 && !path.includes('/auth/')) {
    const t = await refreshAccessToken();
    if (t) res = await doFetch(t);
  }
  const body = await parse(res);
  if (!res.ok) {
    // Proxy/infrastructure failures come back as plain text; never show those raw to users.
    const infra = res.status >= 500 && (!body?.statusCode || body?.message === 'Internal Server Error');
    const msg = infra
      ? 'We could not reach the server. Please check your connection and try again in a moment.'
      : Array.isArray(body?.message)
        ? body.message.join(', ')
        : body?.message ?? res.statusText;
    throw new ApiError(res.status, body?.code, msg, body);
  }
  return body as T;
}

export const apiGet = <T = any>(path: string, query?: RequestOptions['query']) => api<T>(path, { query });
export const apiPost = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const apiPut = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });
export const apiPatch = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const apiDelete = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
