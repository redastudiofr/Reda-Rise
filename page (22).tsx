'use client';

import { useEffect, useState } from 'react';
import { useData } from '@/components/DataProvider';
import type { Settings } from '@/lib/types';

const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className="switch" data-on={on} onClick={onClick} aria-pressed={on}>
      <i />
    </button>
  );
}

export default function SettingsPage() {
  const { data, update, durable, authOn } = useData();
  const s = data.settings;
  const [permission, setPermission] = useState<string>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true,
    );
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(Boolean(sub)))
        .catch(() => setSubscribed(false));
    }
  }, []);

  function patch(fn: (settings: Settings) => Settings) {
    update((d) => ({ ...d, settings: fn(d.settings) }));
  }

  function setNotif(key: keyof Settings['notifications'], value: Record<string, unknown>) {
    patch((prev) => {
      const notifications = {
        ...prev.notifications,
        [key]: { ...(prev.notifications[key] as Record<string, unknown>), ...value },
      } as Settings['notifications'];
      return { ...prev, notifications };
    });
  }

  async function enablePush() {
    setBusy(true);
    setMessage(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error("Ce navigateur ne gère pas les notifications push.");
      }
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') throw new Error('Permission refusée dans les réglages du navigateur.');

      const reg = await navigator.serviceWorker.ready;
      const res = await fetch('/api/push/key');
      const { key } = (await res.json()) as { key: string };
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
        }));
      const saved = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!saved.ok) throw new Error("L'abonnement n'a pas pu être enregistré.");
      setSubscribed(true);
      setMessage('Notifications activées sur cet appareil.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMessage('Notifications désactivées sur cet appareil.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function testPush() {
    setBusy(true);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const json = (await res.json()) as { sent?: number; failed?: number };
      setMessage(`Test envoyé à ${json.sent ?? 0} appareil(s), ${json.failed ?? 0} échec(s).`);
    } catch {
      setMessage("Le test n'a pas pu être envoyé.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Réglages</h1>
          <p className="sub">Profil, rappels et notifications</p>
        </div>
      </header>

      <section className="section">
        <h2 className="section-title">Profil</h2>
        <div className="card">
          <label className="field">
            <span>Nom</span>
            <input
              className="input"
              value={s.profile.name}
              onChange={(e) =>
                patch((p) => ({ ...p, profile: { ...p.profile, name: e.target.value } }))
              }
            />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Âge</span>
              <input
                className="input"
                type="number"
                value={s.profile.age}
                onChange={(e) =>
                  patch((p) => ({ ...p, profile: { ...p.profile, age: Number(e.target.value) } }))
                }
              />
            </label>
            <label className="field">
              <span>Taille (cm)</span>
              <input
                className="input"
                type="number"
                value={s.profile.heightCm}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    profile: { ...p.profile, heightCm: Number(e.target.value) },
                  }))
                }
              />
            </label>
          </div>
          <label className="field">
            <span>Poids (kg)</span>
            <input
              className="input"
              type="number"
              step="0.1"
              value={s.profile.weightKg}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  profile: { ...p.profile, weightKg: Number(e.target.value) },
                }))
              }
            />
          </label>
          <label className="field">
            <span>Objectif</span>
            <input
              className="input"
              value={s.profile.goal}
              onChange={(e) =>
                patch((p) => ({ ...p, profile: { ...p.profile, goal: e.target.value } }))
              }
            />
          </label>
          <label className="field">
            <span>Fuseau horaire</span>
            <input
              className="input"
              value={s.timezone}
              onChange={(e) => patch((p) => ({ ...p, timezone: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Notifications push</h2>
        <div className="card">
          <div className="row">
            <div>
              <div className="ex-name">Cet appareil</div>
              <div className="ex-meta">
                {subscribed
                  ? 'Abonné aux rappels'
                  : permission === 'denied'
                    ? 'Permission refusée dans le navigateur'
                    : 'Non abonné'}
              </div>
            </div>
            <Switch on={subscribed} onClick={() => (subscribed ? disablePush() : enablePush())} />
          </div>
          {!standalone ? (
            <div className="banner warn">
              Sur iPhone, les notifications ne fonctionnent qu&apos;une fois l&apos;app ajoutée à
              l&apos;écran d&apos;accueil : Partager, puis « Sur l&apos;écran d&apos;accueil », puis
              rouvrir depuis l&apos;icône.
            </div>
          ) : null}
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={testPush} disabled={busy || !subscribed}>
              Envoyer une notification de test
            </button>
          </div>
          {message ? <div className="banner">{message}</div> : null}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Rappels</h2>

        <div className="card">
          <div className="row">
            <div>
              <div className="ex-name">Créatine</div>
              <div className="ex-meta">Rappel quotidien</div>
            </div>
            <Switch
              on={s.notifications.creatine.enabled}
              onClick={() => setNotif('creatine', { enabled: !s.notifications.creatine.enabled })}
            />
          </div>
          <label className="field">
            <span>Heure</span>
            <input
              className="input"
              type="time"
              value={s.notifications.creatine.time}
              onChange={(e) => setNotif('creatine', { time: e.target.value })}
            />
          </label>
        </div>

        <div className="card">
          <div className="row">
            <div>
              <div className="ex-name">Hydratation</div>
              <div className="ex-meta">
                Toutes les {s.notifications.hydration.everyHours} h entre deux heures
              </div>
            </div>
            <Switch
              on={s.notifications.hydration.enabled}
              onClick={() => setNotif('hydration', { enabled: !s.notifications.hydration.enabled })}
            />
          </div>
          <div className="grid-2">
            <label className="field">
              <span>Début</span>
              <input
                className="input"
                type="time"
                value={s.notifications.hydration.start}
                onChange={(e) => setNotif('hydration', { start: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Fin</span>
              <input
                className="input"
                type="time"
                value={s.notifications.hydration.end}
                onChange={(e) => setNotif('hydration', { end: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            <span>Intervalle (heures)</span>
            <input
              className="input"
              type="number"
              min="1"
              max="6"
              value={s.notifications.hydration.everyHours}
              onChange={(e) =>
                setNotif('hydration', { everyHours: Math.max(1, Number(e.target.value)) })
              }
            />
          </label>
        </div>

        <div className="card">
          <div className="row">
            <div>
              <div className="ex-name">Repas</div>
              <div className="ex-meta">Trois rappels quotidiens</div>
            </div>
            <Switch
              on={s.notifications.meals.enabled}
              onClick={() => setNotif('meals', { enabled: !s.notifications.meals.enabled })}
            />
          </div>
          {['Petit-déjeuner', 'Déjeuner', 'Dîner'].map((label, i) => (
            <label key={label} className="field">
              <span>{label}</span>
              <input
                className="input"
                type="time"
                value={s.notifications.meals.times[i] ?? ''}
                onChange={(e) => {
                  const times = [...s.notifications.meals.times];
                  times[i] = e.target.value;
                  setNotif('meals', { times });
                }}
              />
            </label>
          ))}
        </div>

        <div className="card">
          <div className="row">
            <div>
              <div className="ex-name">Sommeil</div>
              <div className="ex-meta">Rappel de préparation au coucher</div>
            </div>
            <Switch
              on={s.notifications.sleep.enabled}
              onClick={() => setNotif('sleep', { enabled: !s.notifications.sleep.enabled })}
            />
          </div>
          <label className="field">
            <span>Heure</span>
            <input
              className="input"
              type="time"
              value={s.notifications.sleep.time}
              onChange={(e) => setNotif('sleep', { time: e.target.value })}
            />
          </label>
        </div>

        <div className="card">
          <div className="row">
            <div>
              <div className="ex-name">Séance</div>
              <div className="ex-meta">Les jours d&apos;entraînement</div>
            </div>
            <Switch
              on={s.notifications.workout.enabled}
              onClick={() => setNotif('workout', { enabled: !s.notifications.workout.enabled })}
            />
          </div>
          <label className="field">
            <span>Heure</span>
            <input
              className="input"
              type="time"
              value={s.notifications.workout.time}
              onChange={(e) => setNotif('workout', { time: e.target.value })}
            />
          </label>
          <div className="field">
            <span>Jours</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {DAYS.map((label, i) => {
                const on = s.notifications.workout.days.includes(i);
                return (
                  <button
                    key={i}
                    className="pill"
                    data-on={on}
                    style={{ flex: 1, textAlign: 'center', padding: '9px 0' }}
                    onClick={() => {
                      const days = on
                        ? s.notifications.workout.days.filter((d) => d !== i)
                        : [...s.notifications.workout.days, i].sort();
                      setNotif('workout', { days });
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="row">
            <div>
              <div className="ex-name">Objectifs du jour</div>
              <div className="ex-meta">Rappel de ce qu&apos;il reste à accomplir</div>
            </div>
            <Switch
              on={s.notifications.objectives.enabled}
              onClick={() =>
                setNotif('objectives', { enabled: !s.notifications.objectives.enabled })
              }
            />
          </div>
          <label className="field">
            <span>Heure</span>
            <input
              className="input"
              type="time"
              value={s.notifications.objectives.time}
              onChange={(e) => setNotif('objectives', { time: e.target.value })}
            />
          </label>
        </div>

        <div className="card">
          <div className="row">
            <div>
              <div className="ex-name">Bilan du jour</div>
              <div className="ex-meta">Invitation à clôturer ta journée</div>
            </div>
            <Switch
              on={s.notifications.review.enabled}
              onClick={() => setNotif('review', { enabled: !s.notifications.review.enabled })}
            />
          </div>
          <label className="field">
            <span>Heure</span>
            <input
              className="input"
              type="time"
              value={s.notifications.review.time}
              onChange={(e) => setNotif('review', { time: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Données</h2>
        <div className="card">
          <div className="row">
            <div>
              <div className="ex-name">Stockage</div>
              <div className="ex-meta">
                {durable
                  ? 'Base de données connectée — les données survivent à une réinstallation.'
                  : 'Aucune base connectée — stockage temporaire côté serveur.'}
              </div>
            </div>
          </div>
          {authOn ? (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={logout}>
                Se déconnecter
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
