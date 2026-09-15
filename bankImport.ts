import type { BankTransaction } from './types';
import { classify } from './bank';

/**
 * Import of a bank statement exported by the user.
 *
 * Every French bank offers a CSV export from its own website. Until an
 * aggregator is configured, this is the honest way to get real transactions
 * into the app: the file comes from the user's own bank, nothing is invented,
 * and no credential is involved.
 */

export type ImportResult = {
  transactions: BankTransaction[];
  /** Lines that could not be read, with the reason — shown to the user. */
  errors: string[];
  /** Which columns the parser locked on to, so the user can check the guess. */
  columns: { date: string; label: string; amount: string };
};

/** Splits one CSV line, honouring double quotes around a field. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      out.push(field.trim());
      field = '';
    } else field += char;
  }
  out.push(field.trim());
  return out;
}

/** Whichever of ; , or tab appears most on the header line. */
function detectDelimiter(headerLine: string): string {
  const counts = [';', '\t', ','].map((d) => ({ d, n: headerLine.split(d).length }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 1 ? counts[0].d : ';';
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalize);
  for (const candidate of candidates) {
    const exact = normalized.indexOf(candidate);
    if (exact !== -1) return exact;
  }
  for (const candidate of candidates) {
    const partial = normalized.findIndex((h) => h.includes(candidate));
    if (partial !== -1) return partial;
  }
  return -1;
}

/** dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd and dd/mm/yy all end up as yyyy-mm-dd. */
export function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const match = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year < 70 ? 2000 : 1900;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "1 234,56", "-12.34", "(45,00)" and "1.234,56" all come out as a number. */
export function parseAmount(raw: string): number | null {
  let value = raw.replace(/\s| |€|EUR/gi, '').trim();
  if (value === '') return null;

  let negative = false;
  if (value.startsWith('(') && value.endsWith(')')) {
    negative = true;
    value = value.slice(1, -1);
  }

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma !== -1 && lastComma > lastDot) {
    // French style: dots group the thousands, the comma is the decimal mark.
    value = value.replace(/\./g, '').replace(',', '.');
  } else {
    value = value.replace(/,/g, '');
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

const DATE_HEADERS = ['date', 'date operation', "date d'operation", 'date de valeur', 'date valeur'];
const LABEL_HEADERS = ['libelle', 'label', 'description', 'nature', 'intitule', 'operation', 'motif'];
const AMOUNT_HEADERS = ['montant', 'amount', 'montant eur', 'valeur'];
const DEBIT_HEADERS = ['debit', 'depense', 'retrait'];
const CREDIT_HEADERS = ['credit', 'recette', 'depot'];

/**
 * Reads a bank CSV export into transactions. Handles both a single amount
 * column and the separate debit/credit columns most French banks use. Rows
 * that cannot be read are reported rather than silently dropped.
 */
export function parseTransactionsCsv(text: string, accountId: string): ImportResult {
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');

  if (lines.length < 2) {
    return {
      transactions: [],
      errors: ['Le fichier est vide ou ne contient pas d’en-tête.'],
      columns: { date: '—', label: '—', amount: '—' },
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter);

  const dateIndex = findColumn(headers, DATE_HEADERS);
  const labelIndex = findColumn(headers, LABEL_HEADERS);
  const amountIndex = findColumn(headers, AMOUNT_HEADERS);
  const debitIndex = findColumn(headers, DEBIT_HEADERS);
  const creditIndex = findColumn(headers, CREDIT_HEADERS);

  const columns = {
    date: dateIndex === -1 ? '—' : headers[dateIndex],
    label: labelIndex === -1 ? '—' : headers[labelIndex],
    amount:
      amountIndex !== -1
        ? headers[amountIndex]
        : debitIndex !== -1 || creditIndex !== -1
          ? [headers[debitIndex], headers[creditIndex]].filter(Boolean).join(' / ')
          : '—',
  };

  if (dateIndex === -1 || labelIndex === -1) {
    errors.push(
      'Colonnes date ou libellé introuvables. Attendu un en-tête du type « Date ; Libellé ; Montant ».',
    );
    return { transactions: [], errors, columns };
  }
  if (amountIndex === -1 && debitIndex === -1 && creditIndex === -1) {
    errors.push('Colonne montant introuvable (ou colonnes débit / crédit).');
    return { transactions: [], errors, columns };
  }

  const transactions: BankTransaction[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const date = parseDate(cells[dateIndex] ?? '');
    const label = (cells[labelIndex] ?? '').replace(/\s+/g, ' ').trim();

    if (!date) {
      errors.push(`Ligne ${i + 1} : date illisible (« ${cells[dateIndex] ?? ''} »).`);
      continue;
    }
    if (label === '') {
      errors.push(`Ligne ${i + 1} : libellé vide.`);
      continue;
    }

    let amount: number | null = null;
    if (amountIndex !== -1) {
      amount = parseAmount(cells[amountIndex] ?? '');
    } else {
      const debit = debitIndex === -1 ? null : parseAmount(cells[debitIndex] ?? '');
      const credit = creditIndex === -1 ? null : parseAmount(cells[creditIndex] ?? '');
      if (debit !== null && debit !== 0) amount = -Math.abs(debit);
      else if (credit !== null && credit !== 0) amount = Math.abs(credit);
    }

    if (amount === null || amount === 0) {
      errors.push(`Ligne ${i + 1} : montant illisible.`);
      continue;
    }

    // Same day, same label, same amount twice in one file is a real duplicate.
    const fingerprint = `${date}|${label.toLowerCase()}|${amount}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    transactions.push({
      id: `tx_${fingerprint.replace(/[^a-z0-9]/gi, '').slice(0, 40)}_${i}`,
      accountId,
      date,
      label,
      amount: Math.round(amount * 100) / 100,
      category: classify(label, amount),
    });
  }

  return { transactions, errors, columns };
}

/** Drops rows already stored for that account — importing twice is harmless. */
export function dedupeAgainst(
  incoming: BankTransaction[],
  existing: BankTransaction[],
): BankTransaction[] {
  const known = new Set(
    existing.map((t) => `${t.accountId}|${t.date}|${t.label.toLowerCase()}|${t.amount}`),
  );
  return incoming.filter(
    (t) => !known.has(`${t.accountId}|${t.date}|${t.label.toLowerCase()}|${t.amount}`),
  );
}
