'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Connexion impossible');
      }
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-box" onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="login-mark" src="/icons/icon-192.png" alt="" width={64} height={64} />
        <h1 style={{ fontSize: 22, textAlign: 'center', margin: '0 0 6px', fontWeight: 640 }}>
          Reda Rise
        </h1>
        <p className="sub" style={{ textAlign: 'center', margin: '0 0 22px' }}>
          Accès protégé
        </p>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-accent" type="submit" disabled={busy || password.length === 0}>
            {busy ? 'Connexion…' : 'Entrer'}
          </button>
        </div>
        {error ? <div className="banner warn">{error}</div> : null}
      </form>
    </main>
  );
}
