import type { NextRequest, NextResponse } from 'next/server';
import { fail, isOwner, networkBlockers, sameOrigin } from './server';

/** Moderation routes: the app's owner only (their own password cookie), never a member. */
export function ownerRoute<C = unknown>(handler: (req: NextRequest, ctx: C) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
    if (networkBlockers().length > 0) return fail('Le Network n’est pas activé sur cette app.', 503);
    if (!sameOrigin(req)) return fail('Origine refusée.', 403);
    if (!(await isOwner(req))) return fail('Réservé à la modération.', 403);
    try {
      return await handler(req, ctx);
    } catch (err) {
      console.error('[network admin]', err);
      return fail('Erreur serveur.', 500);
    }
  };
}
