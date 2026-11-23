// ===== API CLIENT =====
// Attaches Bearer token + sends credentials (httpOnly cookie)

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

function getToken(): string | null {
  return localStorage.getItem('hz_token');
}

export function setToken(token: string): void {
  localStorage.setItem('hz_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('hz_token');
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export { ApiError };

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestInit,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  } catch {
    throw new ApiError(0, 'Network error — please check your connection');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      (data as { message?: string })?.message ??
      (data as { error?: string })?.error ??
      `HTTP ${res.status}`;
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>('GET', path, undefined, options),

  post: <T>(path: string, body?: unknown) =>
    request<T>('POST', path, body),

  put: <T>(path: string, body?: unknown) =>
    request<T>('PUT', path, body),

  del: <T>(path: string) =>
    request<T>('DELETE', path),

  patch: <T>(path: string, body?: unknown) =>
    request<T>('PATCH', path, body),
};

// ===== FLIGHT SEARCH HELPERS =====

export function buildFlightSearchUrl(params: {
  origin?: string;
  destination?: string;
  date?: string;
  pax?: number;
}): string {
  const sp = new URLSearchParams();
  if (params.origin) sp.set('origin', params.origin);
  if (params.destination) sp.set('destination', params.destination);
  if (params.date) sp.set('date', params.date);
  if (params.pax) sp.set('pax', String(params.pax));
  return `/flights?${sp.toString()}`;
}

// ===== CARD VALIDATION (CLIENT-SIDE MIRROR) =====

export function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length !== 16) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i]);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function validateCardExpiry(expiry: string): boolean {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const month = parseInt(match[1]);
  const year = parseInt(match[2]) + 2000;
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const exp = new Date(year, month - 1, 1);
  return exp >= new Date(now.getFullYear(), now.getMonth(), 1);
}

export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})/g, '$1 ').trim();
}

export function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}
