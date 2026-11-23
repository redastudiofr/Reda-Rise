import { NextResponse } from 'next/server';
import { hasDatabase, readState, writeData } from '@/lib/db';
import { authEnabled } from '@/lib/auth';
import { normalizeData } from '@/lib/program';
import { reconcileBank } from '@/lib/bank';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, stored } = await readState();
    return NextResponse.json({ data, stored, durable: hasDatabase(), auth: authEnabled() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const incoming = normalizeData(await req.json());
    // A bank sync made on the server since this copy was loaded is not lost.
    const { data: stored, stored: exists } = await readState();
    if (exists) incoming.bank = reconcileBank(incoming.bank, stored.bank);
    const saved = await writeData(incoming);
    return NextResponse.json({ data: saved, durable: hasDatabase(), auth: authEnabled() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
