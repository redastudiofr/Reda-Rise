'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import NetNav from '@/components/network/NetNav';
import { useNet } from '@/components/network/NetContext';
import ProfileEditor from '@/components/network/ProfileEditor';
import { api } from '@/lib/network/client';

export default function MyProfilePage() {
  const { member, setMember } = useNet();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function logout() {
    await api('/logout', { method: 'POST' }).catch(() => undefined);
    setMember(null);
    router.push('/network');
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api('/account', { method: 'DELETE', body: { password } });
      setMember(null);
      router.push('/network');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="net">
      <NetNav title="Mon profil" sub={member?.email ? `Connecté : ${member.email} (jamais affiché)` : undefined} />
      <ProfileEditor />

      <section className="section">
        <h2 className="section-title">Compte</h2>
        <div className="card net-account">
          <button className="btn btn-ghost" onClick={logout}>Se déconnecter</button>
          {!confirm ? (
            <button className="btn btn-ghost ag-del-btn" onClick={() => setConfirm(true)}>Supprimer mon compte</button>
          ) : (
            <div className="net-delete">
              <p className="sub">
                Ton profil, ta photo, tes messages et les événements que tu organises seront supprimés définitivement. Confirme avec ton mot de passe.
              </p>
              <input className="input" type="password" autoComplete="current-password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="ag-sheet-actions">
                <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Annuler</button>
                <button className="btn btn-accent ag-del-btn" onClick={remove} disabled={busy || !password}>Supprimer définitivement</button>
              </div>
              {error ? <div className="banner warn" role="alert">{error}</div> : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
