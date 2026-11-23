import { bankJson } from '@/lib/bankServer';
import { deleteSession } from '@/lib/bankProviders/enableBanking';
import { loadLinks, removeLink } from '@/lib/bankVault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ends a connection: the consent is revoked at the provider (best effort)
 * and the sealed link is deleted here. Works even if the provider is down,
 * so the user can always cut access from the app's side.
 */
export async function POST(req: Request) {
  let id = '';
  try {
    const body = (await req.json()) as { connectionId?: unknown };
    id = typeof body.connectionId === 'string' ? body.connectionId : '';
  } catch {
    /* handled below */
  }
  if (!id) return bankJson({ error: 'bad_request', message: 'Connexion inconnue.' }, 400);

  let revoked = false;
  try {
    const { links } = await loadLinks();
    const link = links.find((l) => l.id === id);
    if (link) {
      await deleteSession(link.sessionId);
      revoked = true;
    }
  } catch {
    // The provider could not be reached: the local link still goes.
  }
  await removeLink(id);
  return bankJson({ ok: true, revoked });
}
