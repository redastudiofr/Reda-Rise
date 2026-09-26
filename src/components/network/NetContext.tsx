'use client';

import { createContext, useContext } from 'react';

export type NetMember = { id: string; email: string; hasProfile: boolean };

export type NetState = {
  enabled: boolean;
  /** Signed in with the app's own password: moderates, and can add events to the agenda. */
  owner: boolean;
  inviteRequired: boolean;
  blockers: { id: string; message: string }[];
  member: NetMember | null;
};

export type NetCtx = NetState & {
  setMember: (m: NetMember | null) => void;
  /** Unread messages, polled while the Network is open. */
  unread: number;
  refreshUnread: () => void;
};

export const NetContext = createContext<NetCtx | null>(null);

export function useNet(): NetCtx {
  const ctx = useContext(NetContext);
  if (!ctx) throw new Error('useNet doit être utilisé dans NetworkShell');
  return ctx;
}
