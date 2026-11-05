import { bad, failed, jsonBody, noStore } from '@/lib/api';
import { chat, type ChatContext, type ChatTurn } from '@/lib/assistant';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await jsonBody<{ message?: unknown; history?: unknown; context?: ChatContext }>(req);
  if (!body) return bad('Requête invalide.');
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
  if (!message) return bad('Message vide.');
  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
        .filter((t): t is ChatTurn => !!t && (t.role === 'user' || t.role === 'jarvis') && typeof t.text === 'string')
        .map((t) => ({ role: t.role, text: t.text.slice(0, 2000) }))
    : [];
  try {
    return Response.json(await chat(message, history, body.context ?? {}), { headers: noStore });
  } catch (e) {
    return failed(e, 'Mon moteur de réflexion');
  }
}
