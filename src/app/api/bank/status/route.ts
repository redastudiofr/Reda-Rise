import { bankJson, bankStatus } from '@/lib/bankServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Whether a bank aggregator is configured, and what still blocks a connection. */
export async function GET() {
  return bankJson(bankStatus());
}
