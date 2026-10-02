'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useData } from '@/components/DataProvider';
import LevelBadge from '@/components/LevelBadge';
import ProgressPanel from '@/components/ProgressPanel';
import { dayXp, formatShort, shiftKey, todayKey } from '@/lib/logic';
import {
  BONUS_XP,
  DIFFICULTIES,
  STREAK_MILESTONES,
  TIERS,
  levelTitle,
  progressStats,
  tierOf,
  xpForLevel,
} from '@/lib/xp';

function Flame() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 3s4.5 3.8 4.5 8a4.5 4.5 0 0 1-9 0c0-1.3.5-2.4 1.2-3.3.2 1.3.9 2.1 1.8 2.1 1.1 0 1.7-.9 1.5-2.3-.2-1.6-.6-3-1-4.5Z" />
      <path d="M6.5 13.6A6 6 0 0 0 12 21a6 6 0 0 0 5.5-7.4" />
    </svg>
  );
}

export default function ProgressionPage() {
  const { data } = useData();
  const tz = data.settings.timezone;
  const today = todayKey(tz);
  const s = useMemo(() => progressStats(data, tz, dayXp, 5), [data, tz]);
  const { level } = s;
  const tier = tierOf(level.level);
  const pct = Math.floor(level.progress * 100);

  const trend =
    s.previous7 > 0 ? Math.round(((s.last7 - s.previous7) / s.previous7) * 100) : s.last7 > 0 ? null : 0;

  const dayLabel = (date: string) =>
    date === today ? 'Aujourd’hui' : date === shiftKey(today, -1) ? 'Hier' : formatShort(date);

  // A window of the ladder around the current level: where you come from, where you go.
  const ladderFrom = Math.max(1, level.level - 2);
  const ladder = Array.from({ length: 7 }, (_, i) => ladderFrom + i);

  const taskMin = Math.min(...data.settings.discipline.map((t) => t.xp));
  const taskMax = Math.max(...data.settings.discipline.map((t) => t.xp));
  const objMin = DIFFICULTIES[0].xp;
  const objMax = DIFFICULTIES[DIFFICULTIES.length - 1].xp;

  return (
    <div className="prog">
      <header className="topbar">
        <div>
          <h1>Progression</h1>
          <p className="sub">
            Niveau {level.level} · {level.title}
          </p>
        </div>
        <span className="prog-links">
          <Link href="/profil/debloquables" className="link-sm">
            Débloquables
          </Link>
          <Link href="/profil/recompenses" className="link-sm">
            Récompenses
          </Link>
        </span>
      </header>

      <div className="prog-grid">
        <div className="prog-col">
          <section className="prog-hero" style={{ ['--tier' as string]: tier.color }}>
            <div className="prog-hero-top">
              <LevelBadge level={level.level} size={76} />
              <div className="prog-hero-id">
                <div className="prog-tier">Palier {tier.label}</div>
                <div className="prog-title">{level.title}</div>
                <div className="prog-total mono">{level.total.toLocaleString('fr-FR')} XP au total</div>
              </div>
            </div>

            <div className="prog-bar-head">
              <span className="mono">
                {level.intoLevel.toLocaleString('fr-FR')} / {level.needed.toLocaleString('fr-FR')} XP
              </span>
              <b className="mono">{pct} %</b>
            </div>
            <div
              className="prog-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={`Progression vers le niveau ${level.level + 1}`}
            >
              <i style={{ width: `${Math.max(2, level.progress * 100)}%` }} />
            </div>
            <div className="prog-next">
              Encore <b className="mono">{level.toNext.toLocaleString('fr-FR')} XP</b> pour le niveau{' '}
              {level.level + 1} — {level.nextTitle}
              {s.daysToNext !== null ? (
                <span>
                  {' '}
                  · ≈ {s.daysToNext} jour{s.daysToNext > 1 ? 's' : ''} à ton rythme
                </span>
              ) : null}
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Statistiques</h2>
            <div className="prog-stats">
              <div>
                <b className="mono streak-value">
                  <Flame />
                  {s.streak}
                </b>
                <span>Série actuelle</span>
              </div>
              <div>
                <b className="mono">{s.bestStreak}</b>
                <span>Meilleure série</span>
              </div>
              <div>
                <b className="mono">+{s.today}</b>
                <span>XP aujourd&apos;hui</span>
              </div>
              <div>
                <b className="mono">+{s.last7.toLocaleString('fr-FR')}</b>
                <span>
                  7 derniers jours
                  {trend !== null && trend !== 0 ? (
                    <em className="mono" data-up={trend > 0}>
                      {' '}
                      {trend > 0 ? '▲' : '▼'} {Math.abs(trend)} %
                    </em>
                  ) : null}
                </span>
              </div>
              <div>
                <b className="mono">{s.avg30}</b>
                <span>XP / jour (30 j)</span>
              </div>
              <div>
                <b className="mono">{s.activeDays}</b>
                <span>Jours actifs</span>
              </div>
              <div>
                <b className="mono">{s.objectivesDone}</b>
                <span>Objectifs terminés</span>
              </div>
              <div>
                <b className="mono">{s.bestDay ? `+${s.bestDay.xp}` : '—'}</b>
                <span>{s.bestDay ? `Meilleur jour · ${formatShort(s.bestDay.date)}` : 'Meilleur jour'}</span>
              </div>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">XP gagnée récemment</h2>
            {s.recentDays.length === 0 ? (
              <div className="card dash-empty">
                <span>Valide un objectif ou coche une tâche : ton premier gain apparaîtra ici.</span>
              </div>
            ) : (
              <div className="card prog-feed">
                {s.recentDays.map((day) => {
                  const objectives = day.items.filter((i) => i.source === 'objectif');
                  const tasks = day.items.filter((i) => i.source === 'tache');
                  const tasksXp = tasks.reduce((a, i) => a + i.xp, 0);
                  const others = day.items.filter((i) => i.source === 'bonus' || i.source === 'finance' || i.source === 'vetement');
                  return (
                    <div key={day.date} className="prog-day">
                      <div className="prog-day-head">
                        <b>{dayLabel(day.date)}</b>
                        <span className="mono">+{day.total} XP</span>
                      </div>
                      <div className="prog-day-items">
                        {objectives.map((g, i) => (
                          <span key={`o${i}`} className="prog-chip" data-source="objectif">
                            {g.label} <em className="mono">+{g.xp}</em>
                          </span>
                        ))}
                        {tasks.length > 0 ? (
                          <span className="prog-chip" data-source="tache">
                            {tasks.length} tâche{tasks.length > 1 ? 's' : ''} Discipline{' '}
                            <em className="mono">+{tasksXp}</em>
                          </span>
                        ) : null}
                        {others.map((g, i) => (
                          <span key={`b${i}`} className="prog-chip" data-source={g.source}>
                            {g.label} <em className="mono">+{g.xp}</em>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="prog-col">
          <section className="section prog-first">
            <h2 className="section-title">Courbe de progression</h2>
            <ProgressPanel />
          </section>

          <section className="section">
            <h2 className="section-title">Paliers</h2>
            <div className="card prog-ladder">
              {ladder.map((l) => {
                const state = l < level.level ? 'done' : l === level.level ? 'current' : 'locked';
                return (
                  <div key={l} className="prog-step" data-state={state}>
                    <LevelBadge level={l} size={34} />
                    <span className="prog-step-main">
                      <span className="prog-step-title">
                        Niveau {l} — {levelTitle(l)}
                      </span>
                      <span className="prog-step-meta mono">
                        {state === 'current'
                          ? `En cours · ${pct} %`
                          : state === 'done'
                            ? 'Atteint'
                            : `À ${xpForLevel(l).toLocaleString('fr-FR')} XP`}
                      </span>
                    </span>
                    {state === 'done' ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--accent-strong)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12.5 10 17.5 19 7" />
                      </svg>
                    ) : null}
                  </div>
                );
              })}
              <div className="prog-tiers">
                {TIERS.map((t, i) => {
                  const next = TIERS[i + 1];
                  return (
                    <span
                      key={t.id}
                      className="prog-tier-chip"
                      data-on={t.id === tier.id}
                      style={{ ['--tier' as string]: t.color }}
                    >
                      {t.label} {next ? `${t.from}–${next.from - 1}` : `${t.from}+`}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Gagner de l&apos;XP</h2>
            <div className="card prog-rules">
              <div>
                <span>Objectif terminé</span>
                <b className="mono">
                  {objMin} à {objMax} XP
                </b>
              </div>
              <div>
                <span>Tâche Discipline</span>
                <b className="mono">
                  {taskMin} à {taskMax} XP
                </b>
              </div>
              <div>
                <span>Tous les objectifs du jour</span>
                <b className="mono">+{BONUS_XP.allObjectives} XP</b>
              </div>
              <div>
                <span>Discipline au complet</span>
                <b className="mono">+{BONUS_XP.perfectChecklist} XP</b>
              </div>
              <div>
                <span>Journée bouclée</span>
                <b className="mono">+{BONUS_XP.closedDay} XP</b>
              </div>
              <div>
                <span>Séries de {STREAK_MILESTONES.slice(0, 4).map((m) => m.days).join(', ')}… jours</span>
                <b className="mono">
                  +{STREAK_MILESTONES[0].xp} à +{STREAK_MILESTONES[STREAK_MILESTONES.length - 1].xp} XP
                </b>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
