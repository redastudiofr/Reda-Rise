'use client';

import { useEffect, useRef } from 'react';

export type ReactorMode = 'idle' | 'listening' | 'thinking' | 'speaking';

const MODE_COLOR: Record<ReactorMode, string> = {
  idle: '#00e5ff',
  listening: '#3dffa8',
  thinking: '#ffb547',
  speaking: '#00e5ff',
};

/**
 * The animated circle. `level` (0–1) comes from the mic or the voice; it is
 * smoothed and written straight to CSS variables, without re-rendering React.
 */
export default function Reactor({ mode, levelRef, size = 320 }: { mode: ReactorMode; levelRef: React.RefObject<number>; size?: number }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    let t = 0;
    const tick = () => {
      t += 1;
      const target = mode === 'thinking' ? 0.35 + 0.25 * Math.sin(t / 9) : levelRef.current ?? 0;
      smooth += (target - smooth) * (target > smooth ? 0.35 : 0.08);
      const breathe = mode === 'idle' ? 0.06 * (1 + Math.sin(t / 40)) : 0;
      root.current?.style.setProperty('--lvl', (smooth + breathe).toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [mode, levelRef]);

  const c = MODE_COLOR[mode];
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  return (
    <div
      ref={root}
      className="relative select-none"
      style={{ width: size, height: size, ['--c' as string]: c }}
      role="img"
      aria-label={`Jarvis : ${{ idle: 'en veille', listening: 'à l’écoute', thinking: 'réfléchit', speaking: 'parle' }[mode]}`}
      data-mode={mode}
    >
      <div
        className="absolute inset-0 rounded-full transition-[box-shadow] duration-300"
        style={{ boxShadow: `0 0 calc(40px + var(--lvl) * 90px) color-mix(in srgb, ${c} calc(18% + var(--lvl) * 40%), transparent)` }}
      />
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f2feff" />
            <stop offset="45%" stopColor={c} stopOpacity="0.95" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="spin-slow" style={{ transformBox: 'fill-box' }}>
          {ticks.map((i) => (
            <line
              key={i}
              x1="100"
              y1="6"
              x2="100"
              y2={i % 5 === 0 ? 16 : 11}
              stroke={c}
              strokeOpacity={i % 5 === 0 ? 0.9 : 0.4}
              strokeWidth={i % 5 === 0 ? 1.6 : 0.8}
              transform={`rotate(${i * 6} 100 100)`}
            />
          ))}
        </g>
        <circle cx="100" cy="100" r="78" fill="none" stroke={c} strokeOpacity="0.35" strokeWidth="1" />
        <g className="spin-rev" style={{ transformBox: 'fill-box' }}>
          <circle cx="100" cy="100" r="70" fill="none" stroke={c} strokeWidth="3" strokeDasharray="40 14 8 14" strokeOpacity="0.8" />
        </g>
        <g className="spin-fast" style={{ transformBox: 'fill-box' }}>
          <circle cx="100" cy="100" r="58" fill="none" stroke={c} strokeWidth="1.2" strokeDasharray="2 6" strokeOpacity="0.9" />
        </g>
        <circle cx="100" cy="100" r="46" fill="none" stroke={c} strokeOpacity="0.5" strokeWidth="6" strokeDasharray="22 6" />
      </svg>
      <div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: '34%',
          height: '34%',
          transform: 'translate(-50%, -50%) scale(calc(0.82 + var(--lvl) * 0.45))',
          background: 'radial-gradient(circle, #f2feff 0%, var(--c) 42%, transparent 72%)',
          filter: 'blur(0.5px)',
        }}
      />
    </div>
  );
}
