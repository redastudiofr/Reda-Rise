'use client';

/** Full-screen confirmation shown the moment an objective is validated. */
export default function XpBurst({
  amount,
  title,
  label = 'Objectif terminé',
}: {
  amount: number;
  title: string;
  label?: string;
}) {
  return (
    <div className="burst" aria-live="polite">
      <div className="burst-card">
        <div className="burst-label">{label}</div>
        <div className="burst-xp">+{amount} XP</div>
        <div className="burst-title">{title}</div>
      </div>
    </div>
  );
}
