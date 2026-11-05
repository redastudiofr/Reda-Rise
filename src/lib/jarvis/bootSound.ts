'use client';

/**
 * The start-up sound, synthesised (no file to download): a rising hum, a
 * shimmer, then a soft "online" chime. About 4 seconds.
 * Returns false when the browser refuses sound without a click.
 */
export async function playBootSound(): Promise<boolean> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return false;
  const ctx = new Ctx();
  try {
    await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 300))]);
  } catch {
    /* state checked below */
  }
  if (ctx.state !== 'running') {
    void ctx.close();
    return false;
  }
  const t0 = ctx.currentTime + 0.05;
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  // Rising hum, filtered so it stays warm.
  const hum = ctx.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.setValueAtTime(48, t0);
  hum.frequency.exponentialRampToValueAtTime(196, t0 + 2.4);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(200, t0);
  lp.frequency.exponentialRampToValueAtTime(1800, t0 + 2.4);
  const humGain = ctx.createGain();
  humGain.gain.setValueAtTime(0.0001, t0);
  humGain.gain.exponentialRampToValueAtTime(0.35, t0 + 1.6);
  humGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.9);
  hum.connect(lp).connect(humGain).connect(master);
  hum.start(t0);
  hum.stop(t0 + 3);

  // Shimmer: quick high blips, like systems coming up.
  [0.6, 0.9, 1.15, 1.35, 1.52, 1.66, 1.78, 1.88].forEach((dt, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 1200 + i * 140;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.07, t0 + dt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.12);
    o.connect(g).connect(master);
    o.start(t0 + dt);
    o.stop(t0 + dt + 0.15);
  });

  // "Online": a soft major chord with a slow fade.
  const tc = t0 + 2.55;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i === 3 ? 'sine' : 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, tc + i * 0.06);
    g.gain.exponentialRampToValueAtTime(0.14, tc + i * 0.06 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, tc + 1.6);
    o.connect(g).connect(master);
    o.start(tc + i * 0.06);
    o.stop(tc + 1.7);
  });
  setTimeout(() => void ctx.close(), 5000);
  return true;
}
