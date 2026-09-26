'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Loader from '../Loader';
import { api } from '@/lib/network/client';
import { NetContext, type NetMember, type NetState } from './NetContext';
import NetAuth from './NetAuth';
import ProfileEditor from './ProfileEditor';

/**
 * Entry point of every /network page. Works out who is calling, then:
 * - the owner gets the Network inside their usual app (tab bar, agenda);
 * - any other visitor gets the Network alone, and never the owner's data;
 * - someone not signed in gets the member sign-in / sign-up screen.
 */
export default function NetworkShell({
  children,
  ownerShell,
}: {
  children: React.ReactNode;
  ownerShell: (inner: React.ReactNode) => React.ReactNode;
}) {
  const [state, setState] = useState<NetState | null>(null);
  const [failed, setFailed] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api<NetState>('/me')
      .then((s) => setState({ ...s, blockers: s.blockers ?? [], inviteRequired: Boolean(s.inviteRequired) }))
      .catch(() => setFailed(true));
  }, []);

  const memberId = state?.member?.id;
  const refreshUnread = useCallback(() => {
    if (!memberId) return;
    api<{ unread: number }>('/unread')
      .then((r) => setUnread(r.unread))
      .catch(() => undefined);
  }, [memberId]);

  useEffect(() => {
    if (!memberId) return;
    refreshUnread();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refreshUnread();
    }, 30_000);
    const onFocus = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [memberId, refreshUnread]);

  const setMember = useCallback((member: NetMember | null) => setState((s) => (s ? { ...s, member } : s)), []);

  if (failed) {
    return (
      <div className="shell">
        <div className="card dash-empty" style={{ marginTop: 40 }}>
          <b>Network injoignable.</b>
          <span>Vérifie ta connexion puis recharge la page.</span>
        </div>
      </div>
    );
  }
  if (!state) return <Loader />;

  const inner = (
    <NetContext.Provider value={{ ...state, setMember, unread, refreshUnread }}>
      <Gate>{children}</Gate>
    </NetContext.Provider>
  );
  if (state.owner) return <>{ownerShell(inner)}</>;
  return <div className="shell net-guest">{inner}</div>;
}

function Gate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <NetContext.Consumer>
      {(ctx) => {
        if (!ctx) return null;
        if (!ctx.enabled) return <Disabled owner={ctx.owner} blockers={ctx.blockers} />;
        if (!ctx.member) return <NetAuth />;
        if (!ctx.member.hasProfile && pathname !== '/network/profil') return <ProfileEditor firstTime />;
        return children;
      }}
    </NetContext.Consumer>
  );
}

function Disabled({ owner, blockers }: { owner: boolean; blockers: { id: string; message: string }[] }) {
  return (
    <div className="net">
      <header className="topbar">
        <div>
          <h1>Network</h1>
          <p className="sub">Réseau d’entrepreneurs</p>
        </div>
      </header>
      <div className="card net-off">
        <b>Le Network n’est pas encore activé.</b>
        {owner ? (
          <>
            <span>Il ouvre l’app à d’autres personnes : il ne démarre qu’une fois ces points réglés dans les variables d’environnement Vercel.</span>
            <ul>
              {blockers.map((b) => (
                <li key={b.id}>{b.message}</li>
              ))}
            </ul>
          </>
        ) : (
          <span>Reviens plus tard.</span>
        )}
      </div>
    </div>
  );
}
