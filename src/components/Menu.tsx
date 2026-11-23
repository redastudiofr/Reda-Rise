'use client';

import { useEffect, type ReactNode } from 'react';

export type MenuItem = { label: string; icon: ReactNode; onSelect: () => void; danger?: boolean };

/** Petit menu flottant. Se ferme au clic en dehors ou après une action. */
export function Menu({
  open,
  onClose,
  items,
  top,
  bottom,
  right = 20,
}: {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  top?: string;
  bottom?: string;
  right?: number;
}) {
  const pos = top ? { top } : { bottom: bottom ?? 'calc(var(--safe-bottom) + 190px)' };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="scrim" style={{ background: 'transparent' }} onClick={onClose} aria-hidden="true" />
      <div className="menu" role="menu" style={{ ...pos, right }}>
        {items.map((it) => (
          <button
            key={it.label}
            role="menuitem"
            className={it.danger ? 'danger' : undefined}
            onClick={() => {
              onClose();
              it.onSelect();
            }}
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    </>
  );
}
