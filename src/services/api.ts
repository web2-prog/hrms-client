const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

let onUnauthorized: (() => void) | null = null;

/** Register handler for expired/invalid tokens (called from AuthProvider). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function api<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    formData?: FormData;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers || {}) };
  const token = localStorage.getItem('hrms_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || (body ? 'POST' : 'GET'),
    headers,
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    if (res.status === 401 && token) {
      localStorage.removeItem('hrms_token');
      onUnauthorized?.();
    }
    throw new Error(err.message || 'Request failed');
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  if (
    ct.includes('application/pdf') ||
    ct.includes('application/msword') ||
    ct.includes('officedocument') ||
    ct.includes('application/octet-stream') ||
    ct.startsWith('image/') ||
    ct.includes('attachment')
  ) {
    return (await res.blob()) as T;
  }
  // Content-Disposition attachment without matching content-type (res.download)
  const cd = res.headers.get('content-disposition') || '';
  if (cd.includes('attachment')) return (await res.blob()) as T;
  return undefined as T;
}

export function apiUrl(path: string) {
  const base = `${API_BASE.replace(/\/api$/, '')}${path}`;
  if (path.startsWith('/uploads/')) {
    const token = localStorage.getItem('hrms_token');
    if (token) return `${base}?access_token=${encodeURIComponent(token)}`;
  }
  return base;
}

export type ListResult<T> = { data: T[]; total: number; page: number; limit: number; pages: number };

export function buildQuery(params: Record<string, string | number | undefined | null | boolean>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}
