'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/components/DataProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import { dayXp, formatDate, uid } from '@/lib/logic';
import { levelFromXp, rewardStates, streakOf, totalXpOf } from '@/lib/xp';
import type { Reward } from '@/lib/types';

type BoardRow = {
  playerId: string;
  pseudo: string;
  xp: number;
  level: number;
  streak: number;
  updatedAt: string;
};

type BoardState =
  | { kind: 'loading' }
  | { kind: 'ready'; rows: BoardRow[]; durable: boolean }
  | { kind: 'error'; message: string };

export default function RewardsPage() {
  const { data, update } = useData();
  const tz = data.settings.timezone;
  const profile = data.settings.profile;

  const [rewardLevel, setRewardLevel] = useState('');
  const [rewardLabel, setRewardLabel] = useState('');
  const [toDelete, setToDelete] = useState<Reward | null>(null);
  const [board, setBoard] = useState<BoardState>({ kind: 'loading' });

  const totalXp = useMemo(() => totalXpOf(data, dayXp), [data]);
  const level = levelFromXp(totalXp);
  const streak = useMemo(() => streakOf(data, tz, dayXp), [data, tz]);
  const states = useMemo(() => rewardStates(data, dayXp), [data]);

  const unlocked = states.filter((s) => s.unlocked);
  const locked = states.filter((s) => !s.unlocked);
  const next = locked[0] ?? null;

  const history = useMemo(
    () =>
      unlocked
        .filter((s) => s.unlockedAt)
        .sort((a, b) => (a.unlockedAt! < b.unlockedAt! ? 1 : -1)),
    [unlocked],
  );

  const pseudo = (profile.pseudo || profile.name || '').trim();
  const sharing = data.player.shareToLeaderboard;

  const loadBoard = useCallback(async () => {
    setBoard({ kind: 'loading' });
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { rows: BoardRow[]; durable: boolean };
      setBoard({ kind: 'ready', rows: json.rows ?? [], durable: Boolean(json.durable) });
    } catch {
      setBoard({
        kind: 'error',
        message: 'Le classement n’a pas pu être chargé. Vérifie ta connexion et réessaie.',
      });
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  // Republish only when the numbers actually moved, not on every render.
  const published = useRef('');
  useEffect(() => {
    if (!sharing || pseudo === '') return;
    const signature = `${data.player.id}|${pseudo}|${totalXp}|${level.level}|${streak}`;
    if (published.current === signature) return;
    published.current = signature;

    void (async () => {
      try {
        await fetch('/api/leaderboard', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            playerId: data.player.id,
            pseudo,
            xp: totalXp,
            level: level.level,
            streak,
          }),
        });
        await loadBoard();
      } catch {
        /* offline: the next change republishes */
      }
    })();
  }, [sharing, pseudo, totalXp, level.level, streak, data.player.id, loadBoard]);

  async function toggleSharing(on: boolean) {
    update((d) => ({ ...d, player: { ...d.player, shareToLeaderboard: on } }));
    if (!on) {
      published.current = '';
      try {
        await fetch(`/api/leaderboard?playerId=${encodeURIComponent(data.player.id)}`, {
          method: 'DELETE',
        });
        await loadBoard();
      } catch {
        /* the row goes away on the next successful call */
      }
    }
  }

  function addReward() {
    const value = Number(rewardLevel);
    if (!Number.isFinite(value) || value < 1 || rewardLabel.trim() === '') return;
    const reward: Reward = {
      id: uid(),
      level: Math.round(value),
      label: rewardLabel.trim(),
      custom: true,
    };
    update((d) => ({ ...d, rewards: [...d.rewards, reward] }));
    setRewardLevel('');
    setRewardLabel('');
  }

  function removeReward(id: string) {
    update((d) => ({ ...d, rewards: d.rewards.filter((r) => r.id !== id) }));
    setToDelete(null);
  }

  const rows = board.kind === 'ready' ? board.rows : [];
  const myRank = rows.findIndex((r) => r.playerId === data.player.id);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Récompenses</h1>
          <p className="sub">
            {unlocked.length} débloquée{unlocked.length > 1 ? 's' : ''} sur {states.length}
          </p>
        </div>
        <Link href="/profil" className="link-sm">
          Profil
        </Link>
      </header>

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
      </div>

      {next ? (
        <section className="section">
          <h2 className="section-title">Prochaine récompense</h2>
          <div className="card next-reward">
            <div className="row">
              <div style={{ minWidth: 0 }}>
                <div className="next-reward-label">{next.reward.label}</div>
                <div className="ex-meta">
                  Niveau {next.reward.level} · encore {next.levelsLeft} niveau
                  {next.levelsLeft > 1 ? 'x' : ''}
                </div>
              </div>
              <b className="mono next-reward-pct">{Math.round(next.progress * 100)}%</b>
            </div>
            <div className="bar" style={{ marginTop: 12 }}>
              <i style={{ width: `${Math.round(next.progress * 100)}%` }} />
            </div>
          </div>
        </section>
      ) : (
        <section className="section">
          <div className="card empty">
            Toutes les récompenses sont débloquées. Ajoute-t’en une nouvelle plus haut niveau.
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Débloquées · {unlocked.length}</h2>
        {unlocked.length === 0 ? (
          <div className="card empty">Aucune récompense débloquée pour l&apos;instant.</div>
        ) : (
          unlocked.map((s) => (
            <div key={s.reward.id} className="reward" data-on>
              <span className="reward-level mono">{s.reward.level}</span>
              <span className="reward-main">
                <span className="reward-label">{s.reward.label}</span>
                <span className="reward-state">
                  {s.unlockedAt ? `Débloquée le ${formatDate(s.unlockedAt)}` : 'Débloquée'}
                </span>
              </span>
              {s.reward.custom ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setToDelete(s.reward)}>
                  Retirer
                </button>
              ) : null}
            </div>
          ))
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Verrouillées · {locked.length}</h2>
        {locked.length === 0 ? (
          <div className="card empty">Plus rien à débloquer.</div>
        ) : (
          locked.map((s) => (
            <div key={s.reward.id} className="reward" data-on={false}>
              <span className="reward-level mono">{s.reward.level}</span>
              <span className="reward-main">
                <span className="reward-label">{s.reward.label}</span>
                <span className="reward-state">
                  Encore {s.levelsLeft} niveau{s.levelsLeft > 1 ? 'x' : ''}
                </span>
                <span className="bar reward-bar">
                  <i style={{ width: `${Math.round(s.progress * 100)}%` }} />
                </span>
              </span>
              {s.reward.custom ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setToDelete(s.reward)}>
                  Retirer
                </button>
              ) : null}
            </div>
          ))
        )}
      </section>

      {history.length > 0 ? (
        <section className="section">
          <h2 className="section-title">Historique</h2>
          <div className="card">
            {history.map((s) => (
              <div key={s.reward.id} className="rec">
                <div style={{ minWidth: 0 }}>
                  <div className="ex-name">{s.reward.label}</div>
                  <div className="ex-meta">Niveau {s.reward.level}</div>
                </div>
                <div className="rec-val">
                  <b className="mono" style={{ fontSize: 13 }}>
                    {formatDate(s.unlockedAt as string)}
                  </b>
                </div>
              </div>
            ))}
          </div>
          <div className="ex-meta" style={{ margin: '8px 2px' }}>
            Les dates sont retrouvées dans ton historique d&apos;XP : c&apos;est le jour où le
            niveau a réellement été atteint.
          </div>
        </section>
      ) : null}

      <section className="section">
        <h2 className="section-title">Ta propre récompense</h2>
        <div className="card">
          <div className="grid-2">
            <label className="field" style={{ marginTop: 0 }}>
              <span>Niveau</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="20"
                value={rewardLevel}
                onChange={(e) => setRewardLevel(e.target.value)}
              />
            </label>
            <label className="field" style={{ marginTop: 0 }}>
              <span>Récompense</span>
              <input
                className="input"
                placeholder="Restaurant"
                value={rewardLabel}
                onChange={(e) => setRewardLabel(e.target.value)}
              />
            </label>
          </div>
          <div style={{ marginTop: 14 }}>
            <button
              className="btn btn-accent"
              onClick={addReward}
              disabled={rewardLabel.trim() === '' || rewardLevel === ''}
            >
              Ajouter
            </button>
          </div>
        </div>
      </section>

      {/* ---------- classement ---------- */}

      <section className="section">
        <h2 className="section-title">Classement</h2>

        <div className="card">
          <div className="row">
            <div style={{ minWidth: 0 }}>
              <div className="ex-name">Publier mon score</div>
              <div className="ex-meta">
                Seuls ton pseudo, ton XP, ton niveau et ta série sont partagés.
              </div>
            </div>
            <button
              className="switch"
              data-on={sharing}
              onClick={() => void toggleSharing(!sharing)}
              aria-label="Publier mon score"
              disabled={pseudo === ''}
            >
              <i />
            </button>
          </div>
          {pseudo === '' ? (
            <div className="banner warn" style={{ marginTop: 12 }}>
              Choisis d&apos;abord un pseudo dans ton profil pour apparaître au classement.
            </div>
          ) : null}
        </div>

        {board.kind === 'loading' ? (
          <div className="card empty" style={{ marginTop: 10 }}>
            Chargement du classement…
          </div>
        ) : board.kind === 'error' ? (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="banner warn">{board.message}</div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => void loadBoard()}>
              Réessayer
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="card empty" style={{ marginTop: 10 }}>
            Personne n&apos;est encore au classement.
            {sharing
              ? ' Ton score sera publié dès la prochaine synchronisation.'
              : ' Active la publication ci-dessus pour y figurer.'}
          </div>
        ) : (
          <>
            <div className="card" style={{ marginTop: 10 }}>
              {rows.map((row, index) => {
                const me = row.playerId === data.player.id;
                return (
                  <div key={row.playerId} className="rank" data-me={me}>
                    <span className="rank-pos mono" data-top={index < 3}>
                      {index + 1}
                    </span>
                    <span className="rank-main">
                      <span className="rank-name">
                        {row.pseudo}
                        {me ? ' · toi' : ''}
                      </span>
                      <span className="rank-meta">
                        Niveau {row.level} · {row.streak} jour{row.streak > 1 ? 's' : ''} d&apos;affilée
                      </span>
                    </span>
                    <span className="rank-xp mono">{row.xp.toLocaleString('fr-FR')} XP</span>
                  </div>
                );
              })}
            </div>
            {myRank >= 0 ? (
              <div className="ex-meta" style={{ margin: '8px 2px' }}>
                Tu es {myRank + 1}
                {myRank === 0 ? 'ᵉʳ' : 'ᵉ'} sur {rows.length}.
              </div>
            ) : null}
          </>
        )}

        {board.kind === 'ready' && !board.durable ? (
          <div className="banner warn" style={{ marginTop: 10 }}>
            Aucune base de données connectée : le classement est gardé en mémoire et repart à zéro
            au prochain redémarrage du serveur.
          </div>
        ) : null}

        <div className="hint" style={{ marginTop: 12 }}>
          L&apos;application est prévue pour un compte par installation. Le classement se remplit
          lorsque plusieurs personnes utilisent la même base de données — sinon tu y figures seul.
        </div>
      </section>

      {toDelete ? (
        <ConfirmDialog
          title="Retirer cette récompense ?"
          detail={`${toDelete.label} — niveau ${toDelete.level}`}
          confirmLabel="Retirer"
          onConfirm={() => removeReward(toDelete.id)}
          onClose={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}
