'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useData } from '@/components/DataProvider';
import FramedAvatar from '@/components/FramedAvatar';
import { dayXp } from '@/lib/logic';
import type { Cosmetics } from '@/lib/types';
import { FRAMES, THEMES, TITLES, activeCosmetics, allUnlocks } from '@/lib/unlocks';
import { levelFromXp, totalXpOf, xpForLevel } from '@/lib/xp';

function Lock({ level }: { level: number }) {
  return (
    <span className="unl-lock">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      Niv. {level}
    </span>
  );
}

/** Everything a level opens: themes, photo frames, titles, exclusive pieces. */
export default function UnlockablesPage() {
  const { data, update } = useData();
  const state = useMemo(() => levelFromXp(totalXpOf(data, dayXp)), [data]);
  const level = state.level;
  const worn = activeCosmetics(data.settings.cosmetics, level);
  const unlocks = allUnlocks(data.wardrobe.items);
  const done = unlocks.filter((u) => u.level <= level).length;
  const next = unlocks.find((u) => u.level > level);
  const profile = data.settings.profile;

  function wear(patch: Cosmetics) {
    update((d) => ({ ...d, settings: { ...d.settings, cosmetics: { ...d.settings.cosmetics, ...patch } } }));
  }

  const exclusives = data.wardrobe.items.filter((i) => !i.archived && i.minLevel && i.minLevel > 1).sort((a, b) => a.minLevel! - b.minLevel!);

  return (
    <div className="unl">
      <header className="topbar">
        <div>
          <h1>Débloquables</h1>
          <p className="sub">
            Niveau {level} · {done} / {unlocks.length} débloqués
          </p>
        </div>
        <Link href="/profil" className="link-sm">
          ← Profil
        </Link>
      </header>

      <section className="card unl-hero">
        <FramedAvatar frame={worn.frame} src={profile.avatar || undefined} name={profile.pseudo || profile.name} size={64} />
        <div>
          <b>{profile.pseudo || profile.name}</b>
          <span className="unl-title">{worn.title ? worn.title.label : 'Aucun titre'}</span>
          {next ? (
            <small className="sub">
              Prochain : {next.label} au niveau {next.level} · encore {Math.max(0, xpForLevel(next.level) - state.total).toLocaleString('fr-FR')} XP
            </small>
          ) : (
            <small className="sub">Tout est débloqué.</small>
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Thèmes de couleur</h2>
        <div className="unl-grid">
          {THEMES.map((t) => {
            const open = level >= t.level;
            const on = worn.theme.id === t.id;
            return (
              <button
                key={t.id}
                className="card unl-item"
                data-on={on}
                disabled={!open}
                aria-pressed={on}
                onClick={() => wear({ theme: t.id })}
              >
                <span className="unl-swatch" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.strong})`, boxShadow: t.neon ? `0 0 14px ${t.strong}` : undefined }} />
                <b>{t.label}</b>
                {open ? <small>{on ? 'Équipé' : 'Équiper'}</small> : <Lock level={t.level} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Cadres photo</h2>
        <div className="unl-grid">
          <button className="card unl-item" data-on={!worn.frame} aria-pressed={!worn.frame} onClick={() => wear({ frame: undefined })}>
            <FramedAvatar frame={null} src={profile.avatar || undefined} name={profile.pseudo || profile.name} size={40} />
            <b>Sans cadre</b>
            <small>{!worn.frame ? 'Équipé' : 'Équiper'}</small>
          </button>
          {FRAMES.map((f) => {
            const open = level >= f.level;
            const on = worn.frame?.id === f.id;
            return (
              <button key={f.id} className="card unl-item" data-on={on} disabled={!open} aria-pressed={on} onClick={() => wear({ frame: f.id })}>
                <FramedAvatar frame={f} src={profile.avatar || undefined} name={profile.pseudo || profile.name} size={40} />
                <b>{f.label.replace('Cadre ', '').replace(/^./, (c) => c.toUpperCase())}</b>
                {open ? <small>{on ? 'Équipé' : 'Équiper'}</small> : <Lock level={f.level} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Titres</h2>
        <div className="chip-grid">
          <button className="chip" data-on={!worn.title} aria-pressed={!worn.title} onClick={() => wear({ title: undefined })}>
            Aucun
          </button>
          {TITLES.map((t) => {
            const open = level >= t.level;
            const on = worn.title?.id === t.id;
            return (
              <button key={t.id} className="chip unl-chip" data-on={on} disabled={!open} aria-pressed={on} onClick={() => wear({ title: t.id })}>
                {t.label}
                {open ? null : <Lock level={t.level} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Pièces exclusives</h2>
        {exclusives.length === 0 ? (
          <p className="sub">
            Aucune pour l’instant. Dans <Link href="/vetements" className="link-sm">Vêtements</Link>, une pièce avec un niveau requis devient une exclusivité à
            débloquer.
          </p>
        ) : (
          <div className="unl-grid">
            {exclusives.map((i) => (
              <Link key={i.id} href="/vetements" className="card unl-item" data-on={level >= i.minLevel!}>
                {i.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="unl-photo" src={i.photo} alt="" />
                ) : (
                  <span className="unl-swatch" />
                )}
                <b>{i.name}</b>
                {level >= i.minLevel! ? <small>Commandable</small> : <Lock level={i.minLevel!} />}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
