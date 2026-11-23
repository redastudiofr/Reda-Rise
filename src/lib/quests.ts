import type { AppData, Objective } from './types';
import { proofKey } from './types';
import { isDone } from './xp';

/**
 * Quests are the one-off objectives — an objective with `recurrence: 'once'`
 * fixed on a single day. Nothing new is stored: the status below is derived
 * from the day it was set for, whether it was ticked, and whether it was
 * abandoned.
 */

export type QuestStatus = 'en_cours' | 'terminee' | 'expiree' | 'abandonnee';

export const QUEST_FILTERS: { id: QuestStatus; label: string }[] = [
  { id: 'en_cours', label: 'En cours' },
  { id: 'terminee', label: 'Terminées' },
  { id: 'expiree', label: 'Expirées' },
  { id: 'abandonnee', label: 'Abandonnées' },
];

export function questStatusLabel(status: QuestStatus): string {
  return QUEST_FILTERS.find((f) => f.id === status)?.label ?? 'En cours';
}

/** Every one-off objective, whatever its state. Recurring ones are not quests. */
export function allQuests(objectives: Objective[]): Objective[] {
  return objectives.filter((o) => o.recurrence === 'once');
}

export function isQuestDone(data: AppData, quest: Objective): boolean {
  const date = quest.date;
  if (!date) return false;
  return isDone(data.daily[date], quest.id);
}

export function questStatus(data: AppData, quest: Objective, today: string): QuestStatus {
  if (isQuestDone(data, quest)) return 'terminee';
  if (quest.abandonedAt) return 'abandonnee';
  const date = quest.date ?? quest.createdAt;
  return date < today ? 'expiree' : 'en_cours';
}

export type QuestWithStatus = { quest: Objective; status: QuestStatus };

/** Quests with their status, newest day first. */
export function questsWithStatus(data: AppData, today: string): QuestWithStatus[] {
  return allQuests(data.objectives)
    .map((quest) => ({ quest, status: questStatus(data, quest, today) }))
    .sort((a, b) => {
      const da = a.quest.date ?? a.quest.createdAt;
      const db = b.quest.date ?? b.quest.createdAt;
      if (da !== db) return da < db ? 1 : -1;
      return a.quest.createdAt < b.quest.createdAt ? 1 : -1;
    });
}

export function countByStatus(rows: QuestWithStatus[]): Record<QuestStatus, number> {
  const counts: Record<QuestStatus, number> = {
    en_cours: 0,
    terminee: 0,
    expiree: 0,
    abandonnee: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/** The photo attached to a quest, when one was required and provided. */
export function proofOf(data: AppData, quest: Objective) {
  const date = quest.date;
  if (!date) return undefined;
  return data.proofs[proofKey(date, quest.id)];
}

/* ---------- mutations ---------- */

/** Gives up on a quest without losing it: it moves to "abandonnées". */
export function abandonQuest(data: AppData, id: string, today: string): AppData {
  return {
    ...data,
    objectives: data.objectives.map((o) => (o.id === id ? { ...o, abandonedAt: today } : o)),
  };
}

export function resumeQuest(data: AppData, id: string): AppData {
  return {
    ...data,
    objectives: data.objectives.map((o) =>
      o.id === id ? { ...o, abandonedAt: undefined } : o,
    ),
  };
}

/**
 * Removes a quest for good: the objective, every tick that referenced it, and
 * the photo proofs attached to it. Nothing stale is left behind.
 */
export function deleteQuest(data: AppData, id: string): AppData {
  const daily: AppData['daily'] = {};
  for (const [date, entry] of Object.entries(data.daily)) {
    daily[date] = entry.objectives?.includes(id)
      ? { ...entry, objectives: entry.objectives.filter((x) => x !== id) }
      : entry;
  }

  const proofs: AppData['proofs'] = {};
  for (const [key, proof] of Object.entries(data.proofs)) {
    if (proof.objectiveId !== id) proofs[key] = proof;
  }

  return { ...data, objectives: data.objectives.filter((o) => o.id !== id), daily, proofs };
}
