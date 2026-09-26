import type { NextRequest } from 'next/server';
import { authEnabled } from '@/lib/auth';
import { currentMember, inviteCode, isOwner, json, networkBlockers } from '@/lib/network/server';
import { getDoc } from '@/lib/network/store';
import type { ProfileDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Whether the Network runs here, and who is calling: the owner, a member, both or neither. */
export async function GET(req: NextRequest) {
  const blockers = networkBlockers();
  // With no app password the whole app is open; the Network then stays off, and
  // whoever is there gets the usual app around the notice.
  const owner = authEnabled() ? await isOwner(req) : true;
  if (blockers.length > 0) {
    // Only the owner learns what is missing; a visitor just sees that it is off.
    return json({ enabled: false, owner, blockers: owner ? blockers : [], member: null });
  }
  try {
    const me = await currentMember(req);
    const profile = me ? await getDoc<ProfileDoc>('profiles', me.id) : null;
    return json({
      enabled: true,
      owner,
      inviteRequired: inviteCode().length > 0,
      member: me ? { id: me.id, email: me.member.email, hasProfile: Boolean(profile) } : null,
    });
  } catch {
    return json({ enabled: false, owner, blockers: owner ? [{ id: 'db', message: 'Base de données injoignable.' }] : [], member: null }, 503);
  }
}
