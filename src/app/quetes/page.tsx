'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDate, todayKey } from '@/lib/logic';
import { categoryLabel, difficultyLabel } from '@/lib/xp';
import {
  QUEST_FILTERS,
  abandonQuest,
  countByStatus,
  deleteQuest,
  proofOf,
  questsWithStatus,
  resumeQuest,
  type QuestStatus,
} from '@/lib/quests';
import type { Objective } from '@/lib/types';

export default function QuestsPage() {
  const { data, update } = useData();
  const today = todayKey(data.settings.timezone);

  const [filter, setFilter] = useState<QuestStatus>('en_cours');
  const [toDelete, setToDelete] = useState<Objective | null>(null);
  const [toAbandon, setToAbandon] = useState<Objective | null>(null);
  const [openProof, setOpenProof] = useState<string | null>(null);

  const rows = useMemo(() => questsWithStatus(data, today), [data, today]);
  const counts = useMemo(() => countByStatus(rows), [rows]);
  const shown = rows.filter((r) => r.status === filter);

  function confirmAbandon(quest: Objective) {
    update((d) => abandonQuest(d, quest.id, today));
    setToAbandon(null);
  }

  function confirmDelete(quest: Objective) {
    update((d) => deleteQuest(d, quest.id));
    setToDelete(null);
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Quêtes</h1>
          <p className="sub">
            {counts.en_cours} en cours · {counts.terminee} terminée{counts.terminee > 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/" className="link-sm">
          Aujourd&apos;hui
        </Link>
      </header>

      <div className="stat-row" style={{ marginTop: 4 }}>
        <div className="stat">
          <b className="mono">{counts.en_cours}</b>
          <span>En cours</span>
        </div>
        <div className="stat">
          <b className="mono">{counts.terminee}</b>
          <span>Terminées</span>
        </div>
        <div className="stat">
          <b className="mono">{counts.expiree}</b>
          <span>Expirées</span>
        </div>
      </div>

      <section className="section">
        <div className="pill-row">
          {QUEST_FILTERS.map((f) => (
            <button
              key={f.id}
              className="pill"
              data-on={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label} · {counts[f.id]}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="card empty" style={{ marginTop: 12 }}>
            {filter === 'en_cours'
              ? 'Aucune quête en cours. Fixe un objectif ponctuel depuis Aujourd’hui.'
              : filter === 'terminee'
                ? 'Aucune quête terminée pour l’instant.'
                : filter === 'expiree'
                  ? 'Aucune quête expirée — tout est à jour.'
                  : 'Aucune quête abandonnée.'}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {shown.map(({ quest, status }) => {
              const proof = proofOf(data, quest);
              const showProof = openProof === quest.id;
              return (
                <div key={quest.id} className="quest" data-status={status}>
                  <div className="quest-head">
                    <div className="quest-main">
                      <div className="quest-title">{quest.title}</div>
                      <div className="quest-meta">
                        {categoryLabel(quest.category)} · {difficultyLabel(quest.difficulty)}
                        {quest.date ? ` · ${formatDate(quest.date)}` : ''}
                      </div>
                    </div>
                    <span className="xp-chip">+{quest.xp}</span>
                  </div>

                  <div className="quest-tags">
                    <span className="quest-badge" data-status={status}>
                      {QUEST_FILTERS.find((f) => f.id === status)?.label}
                    </span>
                    {quest.requiresProof ? (
                      <span className="quest-badge" data-status="preuve">
                        {proof ? 'Photo fournie' : 'Photo requise'}
                      </span>
                    ) : null}
                  </div>

                  {proof && showProof ? (
                    <div className="proof-preview" style={{ marginTop: 10 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={proof.photo} alt={`Preuve de « ${quest.title} »`} />
                      <div className="ex-meta" style={{ marginTop: 6 }}>
                        Ajoutée le {new Date(proof.takenAt).toLocaleString('fr-FR')}
                      </div>
                    </div>
                  ) : null}

                  <div className="obj-actions">
                    {proof ? (
                      <button onClick={() => setOpenProof(showProof ? null : quest.id)}>
                        {showProof ? 'Masquer la photo' : 'Voir la photo'}
                      </button>
                    ) : null}
                    {status === 'abandonnee' ? (
                      <button onClick={() => update((d) => resumeQuest(d, quest.id))}>
                        Reprendre
                      </button>
                    ) : status !== 'terminee' ? (
                      <button onClick={() => setToAbandon(quest)}>Abandonner</button>
                    ) : null}
                    <button onClick={() => setToDelete(quest)}>Supprimer</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {toAbandon ? (
        <ConfirmDialog
          title="Abandonner cette quête ?"
          detail={`${toAbandon.title} — elle sera rangée dans « Abandonnées », tu pourras la reprendre plus tard.`}
          confirmLabel="Abandonner"
          onConfirm={() => confirmAbandon(toAbandon)}
          onClose={() => setToAbandon(null)}
        />
      ) : null}

      {toDelete ? (
        <ConfirmDialog
          title="Supprimer cette quête ?"
          detail={`${toDelete.title} — la quête, sa validation et sa photo seront effacées définitivement.`}
          onConfirm={() => confirmDelete(toDelete)}
          onClose={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}
