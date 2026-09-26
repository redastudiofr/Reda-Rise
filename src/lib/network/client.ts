/** Browser helper for the /api/network routes: JSON in, JSON out, the server's message on failure. */

export class NetError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/network${path}`, {
      method: init.method ?? 'GET',
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
  } catch {
    throw new NetError(0, 'Pas de connexion. Réessaie quand tu es en ligne.');
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new NetError(res.status, json.error ?? 'Erreur inattendue.');
  return json as T;
}
