import { NextResponse } from 'next/server';
import { bankStatus } from '@/lib/bankServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tells the UI whether a bank aggregator is configured, and what is missing. */
export async function GET() {
  return NextResponse.json(bankStatus());
}
