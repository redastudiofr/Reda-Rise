'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import { useData } from '@/components/DataProvider';
import Curve from '@/components/Curve';
import { computeRecords, dayXp, formatDate, todayKey, uid } from '@/lib/logic';
import { resizeToDataUrl } from '@/lib/image';
import { levelFromXp, rewardStates, series, streakOf, totalXpOf } from '@/lib/xp';
import type { Measurement } from '@/lib/types';

const METRICS = [
  { id: 'weightKg', label: 'Poids', unit: 'kg' },
  { id: 'armCm', label: 'Bras', unit: 'cm' },
  { id: 'chestCm', label: 'Poitrine', unit: 'cm' },
  { id: 'waistCm', label: 'Taille', unit: 'cm' },
  { id: 'thighCm', label: 'Cuisse', unit: 'cm' },
] as const;

type MetricId = (typeof METRICS)[number]['id'];
type View = 'recompenses' | 'mesures' | 'records';

export default function ProfilePage() {
  const { data, update } = useData();
  const tz = data.settings.timezone;
  const profile = data.settings.profile;

  function setProfile(patch: Partial<typeof profile>) {
    update((d) => ({
      ...d,
      settings: { ...d.settings, profile: { ...d.settings.profile, ...patch } },
    }));
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await resizeToDataUrl(file, { max: 192, square: true });
    if (dataUrl) setProfile({ avatar: dataUrl });
  }
  const [view, setView] = useState<View>('recompenses');
  const [metric, setMetric] = useState<MetricId>('weightKg');
  const [form, setForm] = useState<Record<string, string>>({ date: todayKey(tz) });

  const totalXp = useMemo(() => totalXpOf(data, dayXp), [data]);
  const level = levelFromXp(totalXp);
  const streak = useMemo(() => streakOf(data, tz, dayXp), [data, tz]);
  const records = useMemo(() => computeRecords(data.workouts), [data.workouts]);
  const rewards = useMemo(() => rewardStates(data, dayXp), [data]);
  const unlockedCount = rewards.filter((r) => r.unlocked).length;
  const nextReward = rewards.find((r) => !r.unlocked) ?? null;

  const levelPoints = useMemo(() => series(data, tz, 'niveau', 'tout', dayXp), [data, tz]);

  const daysTracked = Object.keys(data.daily).length;
  const objectivesDone = Object.values(data.daily).reduce(
    (a, e) => a + (e.objectives?.length ?? 0),
    0,
  );

  const sorted = useMemo(
    () => [...data.measurements].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [data.measurements],
  );
  const points = useMemo(
    () =>
      sorted
        .map((m) => ({ date: m.date, value: m[metric] }))
        .filter((p): p is { date: string; value: number } => typeof p.value === 'number'),
    [sorted, metric],
  );
  const current = METRICS.find((m) => m.id === metric)!;

  function addMeasurement() {
    const entry: Measurement = { id: uid(), date: form.date || todayKey(tz) };
    let any = false;
    for (const m of METRICS) {
      const raw = form[m.id];
      if (raw && raw.trim() !== '') {
        const num = Number(raw.replace(',', '.'));
        if (Number.isFinite(num)) {
          entry[m.id] = num;
          any = true;
        }
      }
    }
    if (!any) return;
    update((d) => ({
      ...d,
      measurements: [...d.measurements.filter((x) => x.date !== entry.date), entry],
      settings: entry.weightKg
        ? { ...d.settings, profile: { ...d.settings.profile, weightKg: entry.weightKg } }
        : d.settings,
    }));
    setForm({ date: todayKey(tz) });
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Profil</h1>
          <p className="sub">{profile.pseudo || profile.name}</p>
        </div>
      </header>

      <div className="identity">
        <label className="identity-photo">
          <Avatar src={profile.avatar} name={profile.pseudo || profile.name} size={78} />
          <input type="file" accept="image/*" onChange={onPickPhoto} hidden />
          <span className="identity-edit">Changer</span>
        </label>
        <div className="identity-fields">
          <label className="field" style={{ marginTop: 0 }}>
            <span>Pseudo</span>
            <input
              className="input"
              value={profile.pseudo}
              placeholder="Ton pseudo"
              onChange={(e) => setProfile({ pseudo: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Adresse e-mail</span>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={profile.email}
              placeholder="toi@exemple.com"
              onChange={(e) => setProfile({ email: e.target.value })}
            />
          </label>
        </div>
      </div>

      {profile.avatar ? (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 10 }}
          onClick={() => setProfile({ avatar: '' })}
        >
          Retirer la photo
        </button>
      ) : null}

      <div className="level-card">
        <div className="row">
          <div>
            <div className="level-tag">Niveau</div>
            <div className="level-number mono">{level.level}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="level-xp mono">
              {level.intoLevel} / {level.needed} XP
            </div>
            <div className="level-xp mono" style={{ opacity: 0.65 }}>
              {level.total} XP au total
            </div>
          </div>
        </div>
        <div className="bar">
          <i style={{ width: `${Math.round(level.progress * 100)}%` }} />
        </div>
        <Curve points={levelPoints} />
      </div>

      <div className="stat-row">
        <div className="stat">
          <b className="mono">{streak}</b>
          <span>Jours d&apos;affilée</span>
        </div>
        <div className="stat">
          <b className="mono">{objectivesDone}</b>
          <span>Objectifs validés</span>
        </div>
        <div className="stat">
          <b className="mono">{daysTracked}</b>
          <span>Jours suivis</span>
        </div>
      </div>

      <section className="section">
        <div className="segmented">
          <button data-on={view === 'recompenses'} onClick={() => setView('recompenses')}>
            Récompenses
          </button>
          <button data-on={view === 'mesures'} onClick={() => setView('mesures')}>
            Mesures
          </button>
          <button data-on={view === 'records'} onClick={() => setView('records')}>
            Records
          </button>
        </div>
      </section>

      {view === 'recompenses' ? (
        <>
          <section className="section">
            {rewards.slice(0, 4).map((s) => (
              <div key={s.reward.id} className="reward" data-on={s.unlocked}>
                <span className="reward-level mono">{s.reward.level}</span>
                <span className="reward-main">
                  <span className="reward-label">{s.reward.label}</span>
                  <span className="reward-state">
                    {s.unlocked
                      ? s.unlockedAt
                        ? `Débloquée le ${formatDate(s.unlockedAt)}`
                        : 'Débloquée'
                      : `Encore ${s.levelsLeft} niveau${s.levelsLeft > 1 ? 'x' : ''}`}
                  </span>
                </span>
              </div>
            ))}
          </section>

          <section className="section">
            <Link href="/profil/recompenses" className="card row">
              <div>
                <div className="ex-name">Récompenses et classement</div>
                <div className="ex-meta">
                  {unlockedCount} sur {rewards.length} débloquée{unlockedCount > 1 ? 's' : ''}
                  {nextReward ? ` · prochaine : ${nextReward.reward.label}` : ''}
                </div>
              </div>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5.5 15.5 12 9 18.5" />
              </svg>
            </Link>
          </section>
        </>
      ) : null}

      {view === 'mesures' ? (
        <>
          <section className="section">
            <div className="pill-row">
              {METRICS.map((m) => (
                <button
                  key={m.id}
                  className="pill"
                  data-on={m.id === metric}
                  onClick={() => setMetric(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="card" style={{ marginTop: 10 }}>
              <div className="row">
                <div>
                  <div className="level-name mono">
                    {points.length > 0 ? `${points[points.length - 1].value} ${current.unit}` : '—'}
                  </div>
                  <div className="ex-meta">
                    {points.length} relevé{points.length > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <Curve points={points} suffix={` ${current.unit}`} />
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Nouveau relevé</h2>
            <div className="card">
              <label className="field">
                <span>Date</span>
                <input
                  className="input"
                  type="date"
                  value={form.date ?? ''}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <div className="grid-2">
                {METRICS.map((m) => (
                  <label key={m.id} className="field">
                    <span>
                      {m.label} ({m.unit})
                    </span>
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      placeholder="—"
                      value={form[m.id] ?? ''}
                      onChange={(e) => setForm({ ...form, [m.id]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-accent" onClick={addMeasurement}>
                  Enregistrer le relevé
                </button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {view === 'records' ? (
        <section className="section">
          {records.length === 0 ? (
            <div className="card empty">
              Aucun record pour l&apos;instant. Enregistre une séance pour commencer.
            </div>
          ) : (
            <div className="card">
              {records.map((r) => {
                const prev = r.previous;
                const isTime = r.unit === 'sec' || r.unit === 'min';
                const timeUnit = r.unit === 'min' ? 'min' : 's';
                const gain = prev ? r.weight - prev.weight : null;
                return (
                  <div key={r.exerciseId} className="rec">
                    <div style={{ minWidth: 0 }}>
                      <div className="ex-name">{r.name}</div>
                      <div className="ex-meta">
                        {r.dayTitle} · {formatDate(r.date)}
                      </div>
                      {prev ? (
                        <div className="delta">
                          Précédent :{' '}
                          {isTime ? `${prev.reps} ${timeUnit}` : `${prev.weight} kg × ${prev.reps}`}
                        </div>
                      ) : null}
                    </div>
                    <div className="rec-val">
                      <b className="mono">
                        {isTime ? `${r.reps} ${timeUnit}` : `${r.weight} kg`}
                      </b>
                      {!isTime ? <div className="ex-meta mono">× {r.reps} reps</div> : null}
                      {gain !== null && gain > 0 ? (
                        <div className="delta mono">+{Math.round(gain * 10) / 10} kg</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
