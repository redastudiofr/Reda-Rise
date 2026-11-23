import { NextResponse } from 'next/server';
import { mergeSync } from '@/lib/bank';
import { bankGate } from '@/lib/bankServer';
import { fetchAllLinks } from '@/lib/bankSync';
import { cronAuthorized } from '@/lib/cronAuth';
import { readState, writeData } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily bank sync (Vercel Cron, vercel.json). Reads every connected bank and
 * merges balances and transactions into the stored app data, on the server.
 * Answers only with counts: no bank data leaves through this route.
 * A consent that expired marks its connection "à reconnecter" and the job
 * goes on with the others.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const gate = bankGate();
  if (gate) return NextResponse.json({ ok: false, skipped: gate.body.error }, { status: 200 });

  try {
    const { data, stored } = await readState();
    if (!stored || data.bank.connections.length === 0) return NextResponse.json({ ok: true, skipped: 'aucune banque connectée' });
    const { unreadable, errors, ...payload } = await fetchAllLinks();
    const bank = mergeSync(data.bank, payload);
    await writeData({ ...data, bank });
    return NextResponse.json({
      ok: true,
      connections: payload.connections.length,
      needsReconnect: payload.connections.filter((c) => c.status === 'needs_action').length,
      errors,
      unreadable,
      newTransactions: bank.transactions.length - data.bank.transactions.length,
    });
  } catch (err) {
    console.error('[cron bank-sync]', err instanceof Error ? err.message : 'error');
    return NextResponse.json({ ok: false, error: 'sync_failed' }, { status: 500 });
  }
}

export const POST = GET;
