import { useAuth } from './auth-store';
import type { User } from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | undefined | null | string[]>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** internal: prevents infinite refresh loops */
  _retried?: boolean;
}

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api${path}${qs ? `?${qs}` : ''}`;
}

async function parseError(res: Response) {
  let body: { message?: string | string[] } | undefined;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  const raw = body?.message;
  const message = Array.isArray(raw) ? raw[0] : raw || res.statusText || 'Request failed';
  return new ApiError(res.status, message.charAt(0).toUpperCase() + message.slice(1), body);
}

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        useAuth.getState().clear();
        return false;
      }
      const data = (await res.json()) as { user: User; accessToken: string };
      useAuth.getState().setSession(data);
      return true;
    } catch {
      useAuth.getState().clear();
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = useAuth.getState().accessToken;
  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    credentials: 'include',
    signal: opts.signal,
    headers: {
      Accept: 'application/json',
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && !opts._retried && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, { ...opts, _retried: true });
    if (typeof window !== 'undefined') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const data = await api<{ user: User; accessToken: string }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  useAuth.getState().setSession(data);
  return data;
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
  useAuth.getState().clear();
}
