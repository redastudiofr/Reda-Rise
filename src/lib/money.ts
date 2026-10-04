import { formatMoney, formatMoneyExact } from './business';

/**
 * Bank amounts are integer cents everywhere — storage, sums, comparisons —
 * so that 0.1 + 0.2 never shows up as 0.30000000000000004 €. Euros only
 * appear at the edges: when a provider or a CSV gives a decimal, and when a
 * number is shown on screen.
 */

/** Exact cents from a decimal string ("63.40", "-1 234,5", "12") or a number. */
export function toCents(value: string | number): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : null;
  const s = value.trim().replace(/[\s  ]/g, '').replace(/€/g, '');
  const m = /^([+-]?)(\d*)(?:[.,](\d+))?$/.exec(s);
  if (!m || (!m[2] && !m[3])) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const whole = Number(m[2] || '0');
  const frac = m[3] ?? '';
  // Third decimal and beyond: rounded half away from zero, on the digits themselves.
  let cents = whole * 100 + Number((frac + '00').slice(0, 2));
  if (frac.length > 2 && Number(frac[2]) >= 5) cents += 1;
  return sign * cents || 0;
}

/** For display only. */
export const centsToEuros = (cents: number) => cents / 100;

export const formatCents = (cents: number) => formatMoneyExact(cents / 100);
export const formatCentsRounded = (cents: number) => formatMoney(cents / 100);

/** Old documents stored euros as decimals: converted once when read. */
export function legacyToCents(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : undefined;
}
