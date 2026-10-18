const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('mfi_token');
}

export function setSession(token, user) {
  window.localStorage.setItem('mfi_token', token);
  window.localStorage.setItem('mfi_user', JSON.stringify(user));
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('mfi_user');
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  window.localStorage.removeItem('mfi_token');
  window.localStorage.removeItem('mfi_user');
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
