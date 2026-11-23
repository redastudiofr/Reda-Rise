/** An error a person can be told about, without the raw provider message. */
export class ServiceError extends Error {
  constructor(
    public code: 'timeout' | 'network' | 'auth' | 'quota' | 'not_configured' | 'bad_response' | 'not_found',
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
  } catch (e) {
    if (ctrl.signal.aborted) throw new ServiceError('timeout', 'Pas de réponse à temps.');
    throw new ServiceError('network', e instanceof Error ? e.message : 'Réseau indisponible.');
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, ms?: number): Promise<T> {
  const res = await fetchWithTimeout(url, init, ms);
  const text = await res.text();
  if (!res.ok) {
    const code = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'quota' : res.status === 404 ? 'not_found' : 'bad_response';
    throw new ServiceError(code, `HTTP ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ServiceError('bad_response', 'Réponse illisible.');
  }
}
