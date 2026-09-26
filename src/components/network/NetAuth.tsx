'use client';

import { useState } from 'react';
import { api } from '@/lib/network/client';
import { useNet, type NetMember } from './NetContext';

/** Member sign-in and sign-up. Separate from the owner's password. */
export default function NetAuth() {
  const { setMember, inviteRequired, owner } = useNet();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ member: NetMember }>(mode === 'login' ? '/login' : '/signup', {
        method: 'POST',
        body: mode === 'login' ? { email, password } : { email, password, invite, accept },
      });
      setMember(r.member);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const canSubmit = email.includes('@') && password.length >= (mode === 'signup' ? 10 : 1) && (mode === 'login' || accept);

  return (
    <div className="net">
      <header className="topbar">
        <div>
          <h1>Network</h1>
          <p className="sub">Rencontre les entrepreneurs près de chez toi</p>
        </div>
      </header>
      <form className="card net-auth" onSubmit={submit}>
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'signup'} data-on={mode === 'signup'} onClick={() => setMode('signup')}>Créer un compte</button>
          <button type="button" role="tab" aria-selected={mode === 'login'} data-on={mode === 'login'} onClick={() => setMode('login')}>Se connecter</button>
        </div>
        {owner && mode === 'signup' ? (
          <p className="hint">Ton compte Network est distinct du mot de passe de l’app : c’est lui que les autres membres verront.</p>
        ) : null}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Mot de passe{mode === 'signup' ? ' — 10 caractères minimum' : ''}</span>
          <input
            className="input"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === 'signup' && inviteRequired ? (
          <label className="field">
            <span>Code d’invitation</span>
            <input className="input" value={invite} autoComplete="off" onChange={(e) => setInvite(e.target.value)} />
          </label>
        ) : null}
        {mode === 'signup' ? (
          <label className="net-check">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span>
              Je m’engage à rester respectueux, à ne pas faire de démarchage abusif et j’accepte que mon profil (pseudo, entreprise, secteur, ville
              approximative) soit visible des autres membres. Mon email n’est jamais affiché.
            </span>
          </label>
        ) : null}
        <button className="btn btn-accent" type="submit" disabled={busy || !canSubmit}>
          {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
        {error ? <div className="banner warn" role="alert">{error}</div> : null}
      </form>
    </div>
  );
}
