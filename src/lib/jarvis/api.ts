import { securityProblems } from './env';
import { ServiceError } from './http';
import { sameOrigin } from './security';

export const noStore = { 'Cache-Control': 'no-store' };

export function bad(message: string, status = 400) {
  return Response.json({ error: 'bad_request', message }, { status, headers: noStore });
}

/** Errors told in Jarvis' voice; the detail stays in the server logs. */
export function failed(e: unknown, what: string) {
  console.error(`[jarvis] ${what}:`, e instanceof Error ? e.message : e);
  const code = e instanceof ServiceError ? e.code : 'network';
  const message =
    code === 'quota'
      ? 'Mon quota gratuit est épuisé pour le moment, Monsieur. Réessayez dans une minute.'
      : code === 'not_configured'
        ? `${what} n’est pas configuré, Monsieur.`
        : code === 'auth'
          ? `${what} me refuse l’accès. Une reconnexion s’impose peut-être.`
          : `${what} ne répond pas, Monsieur.`;
  return Response.json({ error: code, message }, { status: code === 'quota' ? 429 : code === 'auth' ? 401 : 502, headers: noStore });
}

export async function jsonBody<T>(req: Request): Promise<T | null> {
  if (!sameOrigin(req)) return null;
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** Every Jarvis route: refused while the site itself is not protected. */
export function gate(): Response | null {
  const problems = securityProblems();
  if (problems.length === 0) return null;
  return Response.json({ error: 'jarvis_locked', message: `Jarvis est verrouillé : ${problems.join(' ')}` }, { status: 503, headers: noStore });
}
