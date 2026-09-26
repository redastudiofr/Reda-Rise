'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { useNet } from '@/components/network/NetContext';
import ReportButton from '@/components/network/ReportButton';
import { api } from '@/lib/network/client';
import { LIMITS } from '@/lib/network/validate';

type Msg = { id: string; seq: number; from: string; mine: boolean; author: { id: string; pseudo: string; photo: string | null } | null; text: string; at: string };
type Conv = { id: string; kind: 'dm' | 'event'; title: string; photo: string | null; with: string | null; eventId: string | null; muted: boolean; lastSeq: number; canWrite: boolean; blocker: string | null };
type Resp = { conv: Conv; messages: Msg[]; hasMore: boolean };

const POLL_MS = 4000;

function day(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { refreshUnread } = useNet();
  const [conv, setConv] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const lastSeq = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);
  const readSent = useRef(0);

  const markRead = useCallback(
    (seq: number) => {
      if (seq <= readSent.current) return;
      readSent.current = seq;
      api(`/convs/${id}`, { method: 'PUT', body: { read: seq } })
        .then(refreshUnread)
        .catch(() => undefined);
    },
    [id, refreshUnread],
  );

  const merge = useCallback((incoming: Msg[]) => {
    if (incoming.length === 0) return;
    setMsgs((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      return [...cur, ...incoming.filter((m) => !seen.has(m.id))].sort((a, b) => a.seq - b.seq);
    });
    lastSeq.current = Math.max(lastSeq.current, ...incoming.map((m) => m.seq));
    setTimeout(() => bottom.current?.scrollIntoView({ block: 'end' }), 0);
  }, []);

  useEffect(() => {
    api<Resp>(`/convs/${id}`)
      .then((r) => {
        setConv(r.conv);
        setHasMore(r.hasMore);
        merge(r.messages);
        markRead(Math.max(r.conv.lastSeq, lastSeq.current));
      })
      .catch((e: Error) => setError(e.message));
  }, [id, merge, markRead]);

  // New messages: polled every few seconds while the page is visible.
  useEffect(() => {
    if (!conv) return;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      api<Resp>(`/convs/${id}?after=${lastSeq.current}`)
        .then((r) => {
          setConv(r.conv);
          merge(r.messages);
          if (r.messages.length) markRead(lastSeq.current);
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [conv, id, merge, markRead]);

  async function older() {
    const first = msgs[0]?.seq;
    if (!first) return;
    const r = await api<Resp>(`/convs/${id}?before=${first}`);
    setHasMore(r.hasMore);
    setMsgs((cur) => [...r.messages, ...cur]);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setSendError(null);
    try {
      const r = await api<{ message: Msg }>(`/convs/${id}`, { method: 'POST', body: { text } });
      setText('');
      merge([r.message]);
      readSent.current = Math.max(readSent.current, r.message.seq);
    } catch (err) {
      setSendError((err as Error).message);
    }
    setBusy(false);
  }

  async function remove(m: Msg) {
    try {
      await api(`/messages/${m.id}`, { method: 'DELETE' });
      setMsgs((cur) => cur.filter((x) => x.id !== m.id));
      setPicked(null);
    } catch (err) {
      setSendError((err as Error).message);
    }
  }

  async function toggleMute() {
    if (!conv) return;
    await api(`/convs/${id}`, { method: 'PUT', body: { muted: !conv.muted } }).catch(() => undefined);
    setConv({ ...conv, muted: !conv.muted });
    refreshUnread();
  }

  if (error) {
    return (
      <div className="net">
        <div className="card dash-empty" style={{ marginTop: 24 }}>
          <b>{error}</b>
          <Link href="/network/messages" className="link-sm">← Messages</Link>
        </div>
      </div>
    );
  }

  let lastDay = '';
  return (
    <div className="net net-chat">
      <header className="net-chat-head">
        <Link href="/network/messages" className="link-sm" aria-label="Retour aux messages">←</Link>
        {conv ? (
          <>
            {conv.kind === 'dm' ? (
              <Link href={conv.with ? `/network/membre/${conv.with}` : '#'} className="net-chat-who">
                <Avatar src={conv.photo ?? undefined} name={conv.title} size={34} />
                <b>{conv.title}</b>
              </Link>
            ) : (
              <Link href={`/network/evenements/${conv.eventId}`} className="net-chat-who">
                <b>{conv.title}</b>
                <small>Groupe de l’événement</small>
              </Link>
            )}
            <button className="link-sm" onClick={toggleMute} aria-pressed={conv.muted}>{conv.muted ? 'Réactiver' : 'Mettre en sourdine'}</button>
          </>
        ) : null}
      </header>

      <div className="net-chat-list" aria-live="polite">
        {hasMore ? <button className="link-sm net-older" onClick={older}>Messages précédents</button> : null}
        {conv && msgs.length === 0 ? (
          <p className="empty">
            {conv.kind === 'dm' ? 'Présente-toi et explique pourquoi tu écris : les messages courts et précis ont plus de réponses.' : 'Pas encore de message dans le groupe.'}
          </p>
        ) : null}
        {msgs.map((m) => {
          const d = day(m.at);
          const sep = d !== lastDay;
          lastDay = d;
          return (
            <div key={m.id}>
              {sep ? <div className="net-day">{d}</div> : null}
              <div className="net-msg" data-mine={m.mine}>
                {!m.mine && conv?.kind === 'event' ? <Avatar src={m.author?.photo ?? undefined} name={m.author?.pseudo ?? '?'} size={26} /> : null}
                <button type="button" className="net-bubble" onClick={() => setPicked(picked === m.id ? null : m.id)} aria-expanded={picked === m.id}>
                  {!m.mine && conv?.kind === 'event' ? <small className="net-author">{m.author?.pseudo ?? 'Compte supprimé'}</small> : null}
                  <span className="net-text">{m.text}</span>
                  <small className="net-time">{new Date(m.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small>
                </button>
              </div>
              {picked === m.id ? (
                <div className="net-msg-actions" data-mine={m.mine}>
                  {m.mine ? (
                    <button className="link-sm ag-del-btn" onClick={() => remove(m)}>Supprimer</button>
                  ) : (
                    <ReportButton kind="message" targetId={m.id} label="Signaler ce message" />
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {conv && !conv.canWrite ? (
        <div className="banner warn">{conv.blocker}</div>
      ) : (
        <form className="net-compose" onSubmit={send}>
          <textarea
            className="input"
            rows={1}
            value={text}
            maxLength={LIMITS.message}
            placeholder="Écrire un message…"
            aria-label="Message"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
            }}
          />
          <button className="btn btn-accent" type="submit" disabled={busy || !text.trim()} aria-label="Envoyer">Envoyer</button>
        </form>
      )}
      {sendError ? <div className="banner warn" role="alert">{sendError}</div> : null}
    </div>
  );
}
