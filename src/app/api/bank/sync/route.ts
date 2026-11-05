import { bankGate, bankJson } from '@/lib/bankServer';
import { fetchAllLinks } from '@/lib/bankSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** "Synchroniser": fresh balances and transactions, handed to the browser which merges them. */
export async function POST() {
  const gate = bankGate();
  if (gate) return bankJson(gate.body, gate.status);
  const { errors, ...payload } = await fetchAllLinks();
  void errors;
  return bankJson(payload);
}
