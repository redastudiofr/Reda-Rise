'use client';

import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/auth/login', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { problems?: string[] }) => setProblems(j.problems ?? []))
      .catch(() => undefined);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(json.message ?? 'Accès refusé.');
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accès refusé.');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="hud-panel w-full max-w-sm space-y-5 p-7">
        <div className="text-center">
          <div className="font-display text-2xl tracking-[0.4em] text-cyan">JARVIS</div>
          <div className="hud-label mt-2">Identification requise</div>
        </div>
        {problems.length > 0 ? (
          <div className="rounded-lg border border-amber/60 p-3 text-sm text-amber" role="alert">
            Le serveur n’est pas configuré : {problems.join(' ')}
          </div>
        ) : null}
        <label className="block space-y-2">
          <span className="hud-label">Mot de passe</span>
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            className="hud-input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? (
          <div className="text-sm text-alert" role="alert">
            {error}
          </div>
        ) : null}
        <button className="hud-btn w-full" disabled={busy || !password || problems.length > 0}>
          {busy ? 'Vérification…' : 'Entrer'}
        </button>
      </form>
    </main>
  );
}
