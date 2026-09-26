'use client';

import type { PublicProfile } from '@/lib/network/types';

/** Message, block, report — filled in with the messaging step. */
export default function MemberActions({ profile }: { profile: PublicProfile; blocked: boolean; onBlocked: (b: boolean) => void }) {
  void profile;
  return null;
}
