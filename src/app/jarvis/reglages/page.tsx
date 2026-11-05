'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DEFAULT_COURSES, type Feed, type Settings, type WeeklyBlock } from '@/lib/jarvis/settings';
import { Speaker, frenchVoices, loadVoices, storeVoice, storedVoice } from '@/lib/jarvis/voice';

type Shop = { id: string; name: string; domain: string; auth: 'token' | 'client' | 'missing' };
type GoogleStatus = { configured: boolean; connected: boolean; reason?: string; connectedAt?: string; expiresHint?: string };
type Place = { name: string; lat: number; lon: number; detail: string };

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const toHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHm = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [durable, setDurable] = useState(true);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [cityQuery, setCityQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [feedName, setFeedName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/jarvis/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { settings: Settings; shops: Shop[]; durable: boolean }) => {
        const local = storedVoice();
        setS({ ...j.settings, voiceName: local.name || j.settings.voiceName, rate: local.rate || j.settings.rate });
        setShops(j.shops);
        setDurable(j.durable);
      })
      .catch(() => setMsg('Les réglages n’ont pas pu être chargés.'));
    fetch('/api/jarvis/google/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setGoogle)
      .catch(() => undefined);
    loadVoices().then((v) => setVoices(frenchVoices(v)));
    if (new URLSearchParams(window.location.search).get('google') === 'not_configured')
      setMsg('Google n’est pas configuré : ajoutez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET (voir le README).');
  }, []);

  if (!s) return <main className="p-8 text-cyan-soft">{msg || 'Chargement…'}</main>;
  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });

  async function save() {
    setSaving(true);
    setMsg('');
    storeVoice(s!.voiceName, s!.rate);
    try {
      const r = await fetch('/api/jarvis/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings: s }) });
      const j = (await r.json()) as { settings?: Settings; message?: string };
      if (!r.ok || !j.settings) throw new Error(j.message);
      setS(j.settings);
      setMsg('Réglages enregistrés, Monsieur.');
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : 'Échec de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  async function findCity(e: React.FormEvent) {
    e.preventDefault();
    if (cityQuery.trim().length < 2) return;
    try {
      const r = await fetch(`/api/jarvis/settings/city?q=${encodeURIComponent(cityQuery.trim())}`);
      const j = (await r.json()) as { places?: Place[]; message?: string };
      setPlaces(j.places ?? []);
      if (!j.places?.length) setMsg(j.message ?? 'Aucune ville trouvée.');
    } catch {
      setMsg('La recherche de ville ne répond pas.');
    }
  }

  async function testVoice() {
    const sp = new Speaker();
    const all = await loadVoices();
    sp.voice = all.find((v) => v.name === s!.voiceName) ?? frenchVoices(all)[0];
    sp.rate = s!.rate;
    void sp.speak('Bonjour Monsieur. Votre thé est servi, et vos mails attendent.');
  }

  function addFeed(e: React.FormEvent) {
    e.preventDefault();
    try {
      const u = new URL(feedUrl.trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error();
      set({ feeds: [...s!.feeds, { id: `f${Date.now()}`, name: feedName.trim() || u.hostname, url: u.toString(), enabled: true }] });
      setFeedName('');
      setFeedUrl('');
    } catch {
      setMsg('Adresse de flux invalide.');
    }
  }

  const updateFeed = (id: string, patch: Partial<Feed>) => set({ feeds: s.feeds.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const updateCourse = (i: number, patch: Partial<WeeklyBlock>) => set({ courses: s.courses.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-24 sm:p-8">
      <header className="flex items-center gap-3">
        <Link href="/jarvis" className="hud-btn">
          ← Jarvis
        </Link>
        <h1 className="font-display text-lg tracking-[0.3em] text-cyan">RÉGLAGES</h1>
      </header>

      {!durable ? (
        <div className="hud-panel border-amber/60 p-3 text-sm text-amber">
          Aucune base de données : sur Vercel, réglages et connexion Google seraient perdus à chaque déploiement. Ajoutez DATABASE_URL (voir le README).
        </div>
      ) : null}

      <Panel title="Google">
        {google ? (
          <p className="text-sm">
            {google.connected ? (
              <>
                <span className="text-ok">Connecté</span>
                {google.expiresHint ? ` · en mode test, à renouveler avant le ${new Date(google.expiresHint).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' })}` : ''}
              </>
            ) : (
              <span className="text-amber">{google.reason ?? 'Non connecté'}</span>
            )}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {google?.configured ? (
            <a href="/api/jarvis/google/connect" className={`hud-btn ${google.connected ? '' : 'hud-btn-alert'}`}>
              {google.connected ? 'Reconnecter Google' : 'Connecter Google'}
            </a>
          ) : null}
          {google?.connected ? (
            <button
              className="hud-btn"
              onClick={async () => {
                await fetch('/api/jarvis/google/disconnect', { method: 'POST' });
                setGoogle({ ...google, connected: false, reason: 'Déconnecté.' });
              }}
            >
              Déconnecter
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-cyan-soft/50">Accès demandés : lecture de Gmail, lecture et création d’événements dans l’agenda. Rien d’autre.</p>
      </Panel>

      <Panel title="Ville (météo)">
        <p className="mb-2 text-sm">
          Actuellement : <b>{s.city.name}</b>
        </p>
        <form onSubmit={findCity} className="flex gap-2">
          <input className="hud-input flex-1" placeholder="Rechercher une ville" value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} aria-label="Ville" />
          <button className="hud-btn">Chercher</button>
        </form>
        {places.length ? (
          <ul className="mt-2 space-y-1">
            {places.map((p) => (
              <li key={`${p.lat},${p.lon}`}>
                <button
                  className="w-full rounded-lg border border-hud-line px-3 py-2 text-left text-sm hover:border-cyan"
                  onClick={() => {
                    set({ city: { name: p.name, lat: p.lat, lon: p.lon } });
                    setPlaces([]);
                    setCityQuery('');
                  }}
                >
                  {p.name} <span className="text-cyan-soft/50">{p.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel title="Voix">
        {voices.length === 0 ? <p className="text-sm text-amber">Aucune voix française dans ce navigateur. Edge propose les voix « Natural ».</p> : null}
        <select className="hud-input w-full" value={s.voiceName} onChange={(e) => set({ voiceName: e.target.value })} aria-label="Voix">
          <option value="">Automatique (meilleure voix française)</option>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}
              {/natural/i.test(v.name) ? ' ★' : ''}
            </option>
          ))}
        </select>
        <label className="mt-3 block text-sm">
          Vitesse de lecture : <b className="font-mono">{s.rate.toFixed(2)}</b>
          <input type="range" min={0.7} max={1.4} step={0.05} value={s.rate} onChange={(e) => set({ rate: Number(e.target.value) })} className="mt-1 w-full accent-cyan" />
        </label>
        <button className="hud-btn mt-2" onClick={testVoice}>
          Tester la voix
        </button>
      </Panel>

      <Panel title="Boutiques Shopify">
        {shops.length === 0 ? <p className="text-sm text-cyan-soft/70">Aucune boutique : ajoutez SHOPIFY_SHOP_1_DOMAIN et son jeton (voir le README).</p> : null}
        <ul className="space-y-2">
          {shops.map((sh) => (
            <li key={sh.id} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={!s.disabledShops.includes(sh.id)}
                onChange={(e) => set({ disabledShops: e.target.checked ? s.disabledShops.filter((x) => x !== sh.id) : [...s.disabledShops, sh.id] })}
                aria-label={`Inclure ${sh.name}`}
                className="accent-cyan"
              />
              <b>{sh.name}</b>
              <span className="text-cyan-soft/50">{sh.domain}</span>
              <span className={`ml-auto font-mono text-[11px] ${sh.auth === 'missing' ? 'text-alert' : 'text-ok'}`}>
                {sh.auth === 'token' ? 'jeton' : sh.auth === 'client' ? 'app Dev Dashboard' : 'jeton manquant'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Flux d’actualité">
        <ul className="space-y-2">
          {s.feeds.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.enabled} onChange={(e) => updateFeed(f.id, { enabled: e.target.checked })} className="accent-cyan" aria-label={`Activer ${f.name}`} />
              <input className="hud-input w-36 py-1" value={f.name} onChange={(e) => updateFeed(f.id, { name: e.target.value })} aria-label="Nom du flux" />
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-cyan-soft/60">{f.url}</span>
              <button className="text-alert/80 hover:text-alert" onClick={() => set({ feeds: s.feeds.filter((x) => x.id !== f.id) })} aria-label={`Supprimer ${f.name}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addFeed} className="mt-3 flex flex-wrap gap-2">
          <input className="hud-input w-36" placeholder="Nom" value={feedName} onChange={(e) => setFeedName(e.target.value)} aria-label="Nom du nouveau flux" />
          <input className="hud-input min-w-0 flex-1" placeholder="https://…/rss.xml" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} aria-label="Adresse du nouveau flux" />
          <button className="hud-btn">Ajouter</button>
        </form>
      </Panel>

      <Panel title="Cours et planning">
        <p className="mb-2 text-xs text-cyan-soft/60">Jarvis ne place jamais une tâche sur ces créneaux ni sur un événement de votre agenda.</p>
        <ul className="space-y-2">
          {s.courses.map((c, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <select className="hud-input py-1" value={c.weekday} onChange={(e) => updateCourse(i, { weekday: Number(e.target.value) })} aria-label="Jour">
                {DAYS.map((d, k) => (
                  <option key={d} value={k}>
                    {d}
                  </option>
                ))}
              </select>
              <input type="time" className="hud-input py-1" value={toHm(c.start)} onChange={(e) => updateCourse(i, { start: fromHm(e.target.value) })} aria-label="Début" />
              <span>→</span>
              <input type="time" className="hud-input py-1" value={toHm(c.end)} onChange={(e) => updateCourse(i, { end: fromHm(e.target.value) })} aria-label="Fin" />
              <button className="text-alert/80 hover:text-alert" onClick={() => set({ courses: s.courses.filter((_, k) => k !== i) })} aria-label="Supprimer ce créneau">
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <button className="hud-btn" onClick={() => set({ courses: [...s.courses, { weekday: 1, start: 480, end: 600, label: 'Cours' }] })}>
            + Créneau
          </button>
          <button className="hud-btn" onClick={() => set({ courses: DEFAULT_COURSES })}>
            Rétablir mes cours
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <label>
            Journée de
            <input type="time" className="hud-input ml-2 py-1" value={toHm(s.dayStart)} onChange={(e) => set({ dayStart: fromHm(e.target.value) })} />
          </label>
          <label>
            à
            <input type="time" className="hud-input ml-2 py-1" value={toHm(s.dayEnd)} onChange={(e) => set({ dayEnd: fromHm(e.target.value) })} />
          </label>
          <label>
            Pause entre tâches
            <input type="number" min={0} max={60} className="hud-input ml-2 w-20 py-1" value={s.bufferMinutes} onChange={(e) => set({ bufferMinutes: Number(e.target.value) })} /> min
          </label>
        </div>
      </Panel>

      <div className="fixed inset-x-0 bottom-0 flex items-center justify-end gap-3 border-t border-hud-line bg-hud-bg/90 p-3 backdrop-blur sm:px-8">
        {msg ? (
          <span className="mr-auto text-sm text-cyan-soft" role="status">
            {msg}
          </span>
        ) : null}
        <button className="hud-btn" onClick={save} disabled={saving} data-testid="save">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="hud-panel p-4">
      <h2 className="hud-label mb-3">{title}</h2>
      {children}
    </section>
  );
}
