'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Reactor, { type ReactorMode } from './Reactor';
import { isEcho, parseIntent } from '@/lib/intents';
import { Listener, Speaker, chooseVoice, loadVoices, micLevel, recognitionSupported, storedVoice } from '@/lib/voice';
import type { BlockResult, Section } from '@/lib/briefing';
import type { MailDigest } from '@/lib/mail';
import type { NewsPoint, NewsResult } from '@/lib/news';
import type { Plan } from '@/lib/planner';
import type { ShopDay } from '@/lib/shopify';
import type { Weather } from '@/lib/weather';

const ORDER: Section[] = ['mail', 'shopify', 'weather', 'news', 'calendar'];
const TITLE: Record<Section, string> = { mail: 'Courrier', shopify: 'Ventes', weather: 'Météo', news: 'Actualité', calendar: 'Agenda' };
const QUESTION = 'Que souhaitez-vous accomplir aujourd’hui, Monsieur ?';

type Line = { id: number; role: 'user' | 'jarvis' | 'info'; text: string };
type Status = {
  gemini: { configured: boolean };
  google: { configured: boolean; connected: boolean; reason?: string; expiresHint?: string };
  shops: number;
  durable: boolean;
};
type Phase = 'boot' | 'briefing' | 'talk';

const GOOGLE_RETURN: Record<string, string> = {
  connected: 'Google est connecté. Gmail et l’agenda sont accessibles.',
  refused: 'Connexion Google annulée.',
  state: 'Le retour de Google n’a pas pu être vérifié. Recommencez.',
  scopes: 'Il faut cocher l’accès à Gmail et à l’agenda sur l’écran Google.',
  error: 'Google a refusé la connexion. Vérifiez les identifiants OAuth.',
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

export default function JarvisApp() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [mode, setMode] = useState<ReactorMode>('idle');
  const [results, setResults] = useState<Partial<Record<Section, BlockResult>>>({});
  const [current, setCurrent] = useState<Section | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [caption, setCaption] = useState('');
  const [interim, setInterim] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [micError, setMicError] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [notice, setNotice] = useState('');
  const [clock, setClock] = useState('');

  const levelRef = useRef(0);
  const speaker = useRef<Speaker | null>(null);
  const listener = useRef<Listener | null>(null);
  const fetches = useRef<Partial<Record<Section, Promise<BlockResult>>>>({});
  const resultsRef = useRef<Partial<Record<Section, BlockResult>>>({});
  const planRef = useRef<Plan | null>(null);
  const historyRef = useRef<{ role: 'user' | 'jarvis'; text: string }[]>([]);
  const phaseRef = useRef<Phase>('boot');
  const repeatRef = useRef(false);
  const pending = useRef<(() => Promise<void>)[]>([]);
  const buffer = useRef<string[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spokeAt = useRef(0);
  const busy = useRef(false);
  const lineId = useRef(0);

  planRef.current = plan;
  phaseRef.current = phase;

  const add = useCallback((role: Line['role'], t: string) => {
    setLines((l) => [...l.slice(-60), { id: ++lineId.current, role, text: t }]);
    if (role !== 'info') historyRef.current = [...historyRef.current.slice(-20), { role, text: t }];
  }, []);

  /* ---------- démarrage : statut, préchargement du débrief ---------- */

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/status', { cache: 'no-store' });
      if (r.status === 401) return window.location.assign('/login');
      setStatus((await r.json()) as Status);
    } catch {
      /* shown as unknown */
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const q = new URLSearchParams(window.location.search);
    const g = q.get('google');
    if (g) {
      setNotice(GOOGLE_RETURN[g] ?? GOOGLE_RETURN.error);
      window.history.replaceState(null, '', '/');
    }
    // The briefing is prepared while Monsieur reaches for the button.
    for (const s of ORDER) {
      fetches.current[s] = fetch(`/api/briefing/${s}`, { cache: 'no-store' })
        .then(async (r) => {
          if (r.status === 401) window.location.assign('/login');
          return (await r.json()) as BlockResult;
        })
        .catch((): BlockResult => ({ section: s, ok: false, spoken: `${TITLE[s]} : le serveur ne répond pas, Monsieur. Je poursuis.` }))
        .then((res) => {
          resultsRef.current[s] = res;
          setResults((x) => ({ ...x, [s]: res }));
          return res;
        });
    }
  }, [loadStatus]);

  /* ---------- parole ---------- */

  const say = useCallback(
    async (t: string, log = true) => {
      const sp = speaker.current;
      if (log) add('jarvis', t);
      setCaption(t);
      if (!sp) return true;
      const done = await sp.speak(t);
      spokeAt.current = Date.now();
      return done;
    },
    [add],
  );

  /* ---------- actions ---------- */

  const readMail = useCallback(
    async (from: string) => {
      setMode('thinking');
      try {
        const r = await fetch(`/api/mail/read?from=${encodeURIComponent(from)}`, { cache: 'no-store' });
        const j = (await r.json()) as { mail?: { from: string; subject: string; body: string } | null; message?: string };
        if (!r.ok) return void (await say(j.message ?? 'La messagerie ne répond pas, Monsieur.'));
        if (!j.mail) return void (await say(`Je ne trouve aucun mail récent de ${from}, Monsieur.`));
        const body = j.mail.body.length > 900 ? `${j.mail.body.slice(0, 900).replace(/\s\S*$/, '')}… Le reste est à l’écran, Monsieur.` : j.mail.body;
        add('info', `✉ ${j.mail.from} — ${j.mail.subject}\n\n${j.mail.body}`);
        await say(`Mail de ${j.mail.from}, objet : ${j.mail.subject}. ${body || 'Le message est vide.'}`, false);
      } catch {
        await say('La messagerie ne répond pas, Monsieur.');
      }
    },
    [add, say],
  );

  const detail = useCallback(
    async (n: number) => {
      const news = resultsRef.current.news?.data as NewsResult | undefined;
      const p = news?.points.find((x) => x.n === n);
      if (!p) return void (await say(`Il n’y a pas de point ${n} dans la revue de presse, Monsieur.`));
      setMode('thinking');
      try {
        const r = await fetch('/api/news/detail', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ point: p }) });
        const j = (await r.json()) as { text?: string; message?: string };
        await say(j.text ?? j.message ?? p.sentence);
      } catch {
        await say(`${p.title}. Je n’ai pas pu en obtenir davantage, Monsieur.`);
      }
    },
    [say],
  );

  const confirmPlan = useCallback(async () => {
    const p = planRef.current;
    if (!p || p.items.length === 0) return;
    setCreating(true);
    setMode('thinking');
    try {
      const r = await fetch('/api/plan/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ day: p.day, items: p.items }) });
      const j = (await r.json()) as { created?: unknown[]; skipped?: { title: string; reason: string }[]; message?: string };
      if (!r.ok) return void (await say(j.message ?? 'L’agenda ne répond pas, Monsieur. Rien n’a été créé.'));
      setPlan(null);
      const n = j.created?.length ?? 0;
      const skipped = j.skipped?.length ? ` ${j.skipped.map((s) => s.title).join(', ')} : créneau pris entre-temps, je n’y ai pas touché.` : '';
      await say(`C’est fait, Monsieur. ${n} événement${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à votre agenda Google.${skipped}`);
    } catch {
      await say('L’agenda ne répond pas, Monsieur. Rien n’a été créé.');
    } finally {
      setCreating(false);
    }
  }, [say]);

  const ask = useCallback(
    async (message: string) => {
      setMode('thinking');
      const news = resultsRef.current.news?.data as NewsResult | undefined;
      const mail = resultsRef.current.mail?.data as MailDigest | undefined;
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message,
            history: historyRef.current.slice(0, -1).slice(-12),
            context: { news: news?.points ?? [], mails: (mail?.important ?? []).map((m) => ({ from: m.from, subject: m.subject })), plan: planRef.current },
          }),
        });
        const j = (await r.json()) as { reply?: string; plan?: Plan; message?: string };
        if (j.plan) setPlan(j.plan.items.length || j.plan.unplaced.length ? j.plan : null);
        await say(j.reply ?? j.message ?? 'Pardon, Monsieur, je n’ai pas compris.');
      } catch {
        await say('Le serveur ne répond pas, Monsieur. Réessayez dans un instant.');
      }
    },
    [say],
  );

  /** One thing at a time: commands arriving meanwhile wait their turn. */
  const run = useCallback(async (job: () => Promise<void>) => {
    if (busy.current) {
      pending.current.push(job);
      return;
    }
    busy.current = true;
    try {
      await job();
      while (pending.current.length) await pending.current.shift()!();
    } finally {
      busy.current = false;
      setMode(listener.current?.listening ? 'listening' : 'idle');
    }
  }, []);

  /* ---------- ce que Monsieur dit ou tape ---------- */

  const handle = useCallback(
    (raw: string, typed = false) => {
      const intent = parseIntent(raw, Boolean(planRef.current?.items.length));
      const sp = speaker.current;
      const speakingNow = sp?.speaking ?? false;
      // While Jarvis talks, only commands count (the mic also hears the speakers).
      if (!typed && (speakingNow || Date.now() - spokeAt.current < 700) && isEcho(raw, sp?.lastSpoken ?? '')) return;
      if (!typed && speakingNow && intent.kind === 'free') return;

      if (intent.kind === 'skip') {
        add('user', raw);
        sp?.stop();
        return;
      }
      if (intent.kind === 'repeat') {
        add('user', raw);
        if (phaseRef.current === 'briefing') {
          repeatRef.current = true;
          sp?.stop();
        } else void run(async () => void (await say(sp?.lastSpoken || QUESTION, false)));
        return;
      }
      add('user', raw);
      sp?.stop();
      const job =
        intent.kind === 'detail'
          ? () => detail(intent.point)
          : intent.kind === 'readMail'
            ? () => readMail(intent.from)
            : intent.kind === 'confirm'
              ? () => confirmPlan()
              : intent.kind === 'cancel'
                ? async () => {
                    setPlan(null);
                    await say('Planning abandonné, Monsieur. Rien n’a été créé.');
                  }
                : () => ask(intent.text);
      if (phaseRef.current === 'briefing') pending.current.push(job);
      else void run(job);
    },
    [add, ask, confirmPlan, detail, readMail, run, say],
  );

  const handleRef = useRef(handle);
  handleRef.current = handle;

  /** Spoken phrases are grouped until a short silence, so a list of tasks arrives whole. */
  const onFinal = useCallback((t: string) => {
    if (!t) return;
    const intent = parseIntent(t, Boolean(planRef.current?.items.length));
    if (intent.kind !== 'free') {
      handleRef.current(t);
      return;
    }
    buffer.current.push(t);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      const all = buffer.current.join(' ');
      buffer.current = [];
      setInterim('');
      handleRef.current(all);
    }, 1600);
  }, []);

  /* ---------- le débrief ---------- */

  const briefing = useCallback(async () => {
    setPhase('briefing');
    phaseRef.current = 'briefing';
    const hour = Number(new Date().toLocaleString('fr-FR', { hour: 'numeric', hour12: false, timeZone: 'Europe/Paris' }));
    await say(`${hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'}, Monsieur. Voici votre débrief.`);
    for (const s of ORDER) {
      setCurrent(s);
      const r = resultsRef.current[s] ?? (await (async () => {
        setMode('thinking');
        return fetches.current[s]!;
      })());
      for (;;) {
        repeatRef.current = false;
        setMode('speaking');
        await say(r.spoken);
        if (repeatRef.current) continue;
        break;
      }
      while (pending.current.length) await pending.current.shift()!();
    }
    setCurrent(null);
    setPhase('talk');
    phaseRef.current = 'talk';
    await say(QUESTION);
    setMode(listener.current?.listening ? 'listening' : 'idle');
  }, [say]);

  async function start() {
    const sp = new Speaker();
    sp.unlock();
    const voices = await loadVoices();
    const saved = storedVoice();
    sp.voice = chooseVoice(voices, saved.name);
    sp.rate = saved.rate || 1.05;
    sp.onLevel = (l) => {
      levelRef.current = l;
    };
    sp.onState = (v) => setMode(v ? 'speaking' : listener.current?.listening ? 'listening' : 'idle');
    speaker.current = sp;
    // Server-side voice choice, when this browser has none of its own.
    fetch('/api/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { settings?: { voiceName: string; rate: number } }) => {
        if (!saved.name && j.settings?.voiceName) sp.voice = chooseVoice(voices, j.settings.voiceName);
        if (!saved.rate && j.settings?.rate) sp.rate = j.settings.rate;
      })
      .catch(() => undefined);

    if (recognitionSupported()) {
      const l = new Listener();
      l.onInterim = setInterim;
      l.onFinal = onFinal;
      l.onError = (m) => setMicError(m);
      l.onState = (on) => {
        if (!speaker.current?.speaking) setMode(on ? 'listening' : 'idle');
      };
      listener.current = l;
      l.start();
      void micLevel((lv) => {
        if (!speaker.current?.speaking) levelRef.current = lv;
      });
    } else {
      setMicError('Ce navigateur ne reconnaît pas la voix : utilisez Edge ou Chrome, ou le mode texte.');
    }
    busy.current = true;
    try {
      await briefing();
      while (pending.current.length) await pending.current.shift()!();
    } finally {
      busy.current = false;
    }
  }

  function submitText(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    if (phase === 'boot') return;
    handle(t, true);
  }

  /* ---------- affichage ---------- */

  const google = status?.google;
  const needsGoogle = (google && google.configured && !google.connected) || ORDER.some((s) => results[s]?.needsGoogle);
  const expiresSoon = google?.connected && google.expiresHint && Date.parse(google.expiresHint) - Date.now() < 24 * 3600_000;
  const news = results.news?.data as NewsResult | undefined;

  return (
    <main className="flex min-h-screen flex-col gap-4 p-4 lg:h-screen lg:overflow-hidden lg:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="font-display text-xl tracking-[0.45em] text-cyan">JARVIS</div>
        <div className="font-mono text-sm text-cyan-soft/70">{clock}</div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {status ? (
            <>
              <Chip ok={status.gemini.configured} label="Gemini" />
              <Chip ok={Boolean(google?.connected)} label="Google" />
              <Chip ok={status.shops > 0} label={`Shopify ${status.shops}`} />
            </>
          ) : null}
          {google?.configured ? (
            <a
              href="/api/google/connect"
              className={`hud-btn ${needsGoogle || expiresSoon ? 'hud-btn-alert animate-pulse' : ''}`}
              data-testid="reconnect-google"
              title={needsGoogle ? google.reason : expiresSoon ? 'L’autorisation Google expire dans moins de 24 h.' : 'Renouveler l’autorisation Google (7 jours en mode test).'}
            >
              {needsGoogle ? 'Reconnecter Google' : expiresSoon ? 'Google expire bientôt · Reconnecter' : 'Reconnecter Google'}
            </a>
          ) : null}
          <Link href="/reglages" className="hud-btn" aria-label="Réglages">
            Réglages
          </Link>
        </div>
      </header>

      {notice ? (
        <div className="hud-panel px-4 py-2 text-sm text-cyan-soft" role="status">
          {notice}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_1fr_360px]">
        {/* Débrief */}
        <section className="hud-panel scroll-thin order-2 min-h-0 overflow-y-auto p-4 lg:order-1" aria-label="Débrief">
          <div className="hud-label mb-3">Débrief</div>
          <ol className="space-y-3">
            {ORDER.map((s) => (
              <BlockCard key={s} section={s} result={results[s]} active={current === s} />
            ))}
          </ol>
          {news?.points.length ? (
            <div className="mt-4 border-t border-hud-line pt-3">
              <div className="hud-label mb-2">Points d’actualité</div>
              <ol className="space-y-2 text-sm">
                {news.points.map((p: NewsPoint) => (
                  <li key={p.n} className="leading-snug">
                    <span className="font-mono text-cyan">{p.n}.</span>{' '}
                    <a href={p.link} target="_blank" rel="noreferrer noopener" className="hover:text-cyan">
                      {p.sentence}
                    </a>{' '}
                    <span className="text-xs text-cyan-soft/50">{p.source}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>

        {/* Centre */}
        <section className="order-1 flex min-h-[420px] flex-col items-center justify-center gap-5 lg:order-2">
          <div className="relative">
            <Reactor mode={mode} levelRef={levelRef} size={300} />
            {phase === 'boot' ? (
              <button onClick={start} className="absolute inset-0 m-auto h-32 w-32 rounded-full font-display text-[12px] tracking-[0.12em] text-hud-bg shadow-[0_0_40px_rgba(0,229,255,0.55)]" style={{ background: 'radial-gradient(circle,#e8fdff,#00e5ff)' }} data-testid="start">
                DÉMARRER
              </button>
            ) : null}
          </div>
          <div className="hud-label">{phase === 'boot' ? 'Prêt' : { idle: 'En veille', listening: 'À l’écoute', thinking: 'Analyse', speaking: 'Jarvis parle' }[mode]}</div>
          <p className="min-h-[3.5rem] max-w-2xl text-center text-lg leading-relaxed text-cyan-soft" aria-live="polite" data-testid="caption">
            {caption}
          </p>
          <p className="min-h-6 max-w-2xl text-center font-mono text-sm text-ok/80" data-testid="interim">
            {interim ? `› ${interim}` : ''}
          </p>
          {micError ? <p className="text-center text-sm text-amber">{micError}</p> : null}
        </section>

        {/* Conversation et planning */}
        <section className="hud-panel order-3 flex min-h-0 flex-col p-4">
          {plan ? <PlanCard plan={plan} creating={creating} onConfirm={() => void run(confirmPlan)} onCancel={() => setPlan(null)} /> : null}
          <div className="hud-label mb-2">Transcription</div>
          <div className="scroll-thin min-h-[160px] flex-1 space-y-2 overflow-y-auto pr-1 text-sm" data-testid="transcript">
            {lines.length === 0 ? <p className="text-cyan-soft/40">Ce que vous dites et ce que je réponds s’affichera ici.</p> : null}
            {lines.map((l) => (
              <p
                key={l.id}
                className={
                  l.role === 'user'
                    ? 'ml-6 rounded-lg bg-cyan/10 px-3 py-2 text-right text-cyan-soft'
                    : l.role === 'info'
                      ? 'whitespace-pre-line rounded-lg border border-hud-line px-3 py-2 text-xs text-cyan-soft/80'
                      : 'mr-6 rounded-lg px-3 py-2 text-[#e6fbff]'
                }
              >
                {l.text}
              </p>
            ))}
          </div>
        </section>
      </div>

      <form onSubmit={submitText} className="flex gap-2" aria-label="Mode texte">
        <input
          className="hud-input flex-1"
          placeholder={phase === 'boot' ? 'Appuyez sur Démarrer…' : 'Mode texte : écrivez à Jarvis…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={phase === 'boot'}
          aria-label="Message à Jarvis"
        />
        <button className="hud-btn" disabled={phase === 'boot' || !text.trim()}>
          Envoyer
        </button>
      </form>
    </main>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-hud-line px-2.5 py-1 font-mono text-[11px] text-cyan-soft/80">
      <i className="h-1.5 w-1.5 rounded-full" style={{ background: ok ? 'var(--color-ok)' : 'var(--color-alert)' }} />
      {label}
    </span>
  );
}

function BlockCard({ section, result, active }: { section: Section; result?: BlockResult; active: boolean }) {
  const state = !result ? 'loading' : result.ok ? 'ok' : 'error';
  return (
    <li className={`rounded-xl border px-3 py-2 transition ${active ? 'border-cyan shadow-[0_0_18px_rgba(0,229,255,0.25)]' : 'border-hud-line'}`} data-section={section} data-state={state}>
      <div className="flex items-center gap-2">
        <i className="h-2 w-2 rounded-full" style={{ background: state === 'ok' ? 'var(--color-ok)' : state === 'error' ? 'var(--color-alert)' : 'var(--color-amber)' }} />
        <b className="font-display text-[11px] tracking-[0.18em] uppercase">{TITLE[section]}</b>
        {state === 'loading' ? <span className="ml-auto font-mono text-[10px] text-amber">chargement…</span> : null}
      </div>
      {result ? <BlockBody section={section} result={result} /> : null}
    </li>
  );
}

function BlockBody({ section, result }: { section: Section; result: BlockResult }) {
  if (!result.ok) return <p className="mt-1 text-xs text-alert/90">{result.spoken}</p>;
  const d = result.data as unknown;
  if (section === 'weather') {
    const w = d as Weather;
    return (
      <p className="mt-1 text-sm">
        <span className="font-mono text-lg text-cyan">{w.now}°</span> {w.city} · {w.min}°/{w.max}° · pluie {w.rainChance} %
      </p>
    );
  }
  if (section === 'shopify') {
    const s = d as { days: ShopDay[]; failed: string[] };
    return (
      <ul className="mt-1 space-y-1 text-xs">
        {s.days.map((x) => (
          <li key={x.shop}>
            <b>{x.shop}</b> · {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: x.currency }).format(x.revenue)} · {x.orders} cmd
            {x.top[0] ? <span className="text-cyan-soft/60"> · {x.top[0].title}</span> : null}
          </li>
        ))}
        {s.failed.map((f) => (
          <li key={f} className="text-alert/90">
            {f} : indisponible
          </li>
        ))}
        {s.days.length === 0 && s.failed.length === 0 ? <li className="text-cyan-soft/60">Aucune boutique</li> : null}
      </ul>
    );
  }
  if (section === 'mail') {
    const m = d as MailDigest;
    return (
      <ul className="mt-1 space-y-1 text-xs">
        <li className="text-cyan-soft/60">
          {m.total} reçus · {m.important.length} importants
        </li>
        {m.important.slice(0, 6).map((x) => (
          <li key={x.id}>
            <span className="font-mono text-[10px] uppercase text-cyan/70">{x.group}</span> <b>{x.from}</b> — {x.summary}
          </li>
        ))}
      </ul>
    );
  }
  if (section === 'calendar') {
    const c = d as { events: { id: string; title: string; start: string; allDay: boolean }[] };
    return (
      <ul className="mt-1 space-y-1 text-xs">
        {c.events.length === 0 ? <li className="text-cyan-soft/60">Rien aujourd’hui</li> : null}
        {c.events.map((e) => (
          <li key={e.id}>
            <span className="font-mono text-cyan">{e.allDay ? 'journée' : time(e.start)}</span> {e.title}
          </li>
        ))}
      </ul>
    );
  }
  const n = d as NewsResult;
  return <p className="mt-1 text-xs text-cyan-soft/60">{n.points.length} points · {n.candidates} articles d’hier</p>;
}

function PlanCard({ plan, creating, onConfirm, onCancel }: { plan: Plan; creating: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="mb-4 rounded-xl border border-cyan/60 p-3 shadow-[0_0_24px_rgba(0,229,255,0.15)]" data-testid="plan">
      <div className="hud-label mb-2">Planning proposé · {new Date(`${plan.day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</div>
      <ul className="space-y-1.5 text-sm">
        {plan.items.map((i) => (
          <li key={i.start + i.title} className="flex gap-3">
            <span className="font-mono text-cyan">
              {time(i.start)}–{time(i.end)}
            </span>
            <span>{i.title}</span>
          </li>
        ))}
        {plan.unplaced.map((u) => (
          <li key={u.title} className="text-xs text-amber">
            {u.title} : {u.reason}
          </li>
        ))}
      </ul>
      {plan.items.length ? (
        <div className="mt-3 flex gap-2">
          <button className="hud-btn" onClick={onConfirm} disabled={creating} data-testid="confirm-plan">
            {creating ? 'Création…' : 'Confirmer'}
          </button>
          <button className="hud-btn" onClick={onCancel} disabled={creating}>
            Annuler
          </button>
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-cyan-soft/50">Créé uniquement dans Google Agenda, après votre confirmation (« je confirme »).</p>
    </div>
  );
}
