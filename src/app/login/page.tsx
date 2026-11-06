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
      // Back to the page that asked for the login (Jarvis), never to another site.
      const next = new URLSearchParams(window.location.search).get('next') ?? '';
      window.location.href = /^\/jarvis(\/[\w-]*)?(\?[\w=&-]*)?$/.test(next) ? next : '/';
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
        <h1 className="login-title">Reda Rise</h1>
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="login-studio" src="/icons/reda-studio.png" alt="Reda Studio" width={1712} height={177} />
      </form>
    </main>
  );
}
