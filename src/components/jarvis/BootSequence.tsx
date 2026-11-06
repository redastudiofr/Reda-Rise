'use client';

import { useEffect, useState } from 'react';

const LINES = [
  'INITIALISATION DU NOYAU',
  'MODULE VOCAL · FR-FR',
  'LIAISON GMAIL · AGENDA · SHOPIFY',
  'FLUX D’ACTUALITÉ',
  'JARVIS EN LIGNE',
];

export const BOOT_MS = 4200;

/**
 * Full-screen start-up animation: rings draw in, system lines come up, the
 * core flares, then it fades out. `onDone` fires at the end.
 */
export default function BootSequence({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timers = LINES.map((_, i) => setTimeout(() => setShown(i + 1), 450 + i * 620));
    timers.push(setTimeout(() => setLeaving(true), BOOT_MS - 500));
    timers.push(setTimeout(onDone, BOOT_MS));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-hud-bg transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`}
      data-testid="boot"
      aria-label="Démarrage de Jarvis"
    >
      <svg viewBox="0 0 200 200" className="h-72 w-72 boot-svg" aria-hidden>
        <circle cx="100" cy="100" r="92" className="boot-ring" style={{ animationDelay: '0s' }} />
        <circle cx="100" cy="100" r="76" className="boot-ring boot-dash" style={{ animationDelay: '0.35s' }} />
        <circle cx="100" cy="100" r="60" className="boot-ring" style={{ animationDelay: '0.7s' }} />
        <circle cx="100" cy="100" r="44" className="boot-ring boot-dash" style={{ animationDelay: '1.05s' }} />
        <circle cx="100" cy="100" r="22" className="boot-core" />
      </svg>
      <div className="font-display text-3xl tracking-[0.6em] text-cyan boot-title">JARVIS</div>
      <ol className="h-32 w-80 space-y-1.5 font-mono text-xs text-cyan-soft/80">
        {LINES.slice(0, shown).map((l, i) => (
          <li key={l} className="boot-line flex justify-between">
            <span>› {l}</span>
            <span className={i === LINES.length - 1 ? 'text-ok' : 'text-cyan'}>{i === LINES.length - 1 ? '●' : 'OK'}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
