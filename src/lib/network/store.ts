import { readyPool } from '../db';

/**
 * Generic document store for the Network, on the `net_docs` table.
 *
 * Each document belongs to a collection and a partition (`part`): the
 * messages of one conversation, the sessions of one member… so every list the
 * app needs is one indexed range. `seq` grows with every write and orders
 * messages; clients poll with the last seq they saw.
 */

export type Doc<T> = { id: string; part: string; seq: number; data: T; createdAt: string };

type Row = { id: string; part: string; seq: string; data: unknown; created_at: Date };

function toDoc<T>(r: Row): Doc<T> {
  return { id: r.id, part: r.part, seq: Number(r.seq), data: r.data as T, createdAt: new Date(r.created_at).toISOString() };
}

async function pool() {
  const p = await readyPool();
  if (!p) throw new Error('network: database required');
  return p;
}

export async function getDoc<T>(collection: string, id: string): Promise<Doc<T> | null> {
  const r = await (await pool()).query('select id, part, seq, data, created_at from net_docs where collection = $1 and id = $2', [collection, id]);
  return r.rows[0] ? toDoc<T>(r.rows[0]) : null;
}

export async function getDocs<T>(collection: string, ids: string[]): Promise<Doc<T>[]> {
  if (ids.length === 0) return [];
  const r = await (await pool()).query(
    'select id, part, seq, data, created_at from net_docs where collection = $1 and id = any($2)',
    [collection, ids],
  );
  return r.rows.map((row: Row) => toDoc<T>(row));
}

/** Creates or replaces. Replacing takes a new seq. */
export async function putDoc<T>(collection: string, id: string, part: string, data: T): Promise<number> {
  const r = await (await pool()).query(
    `insert into net_docs (collection, id, part, data) values ($1, $2, $3, $4)
     on conflict (collection, id) do update set part = excluded.part, data = excluded.data,
       seq = nextval(pg_get_serial_sequence('net_docs', 'seq'))
     returning seq`,
    [collection, id, part, JSON.stringify(data)],
  );
  return Number(r.rows[0].seq);
}

/** Creates only; false when the id is taken (e.g. an email already registered). */
export async function insertDoc<T>(collection: string, id: string, part: string, data: T): Promise<number | null> {
  const r = await (await pool()).query(
    `insert into net_docs (collection, id, part, data) values ($1, $2, $3, $4)
     on conflict (collection, id) do nothing returning seq`,
    [collection, id, part, JSON.stringify(data)],
  );
  return r.rows[0] ? Number(r.rows[0].seq) : null;
}

export async function deleteDoc(collection: string, id: string): Promise<void> {
  await (await pool()).query('delete from net_docs where collection = $1 and id = $2', [collection, id]);
}

export type ListOptions = {
  part?: string;
  /** Only documents whose data[field] equals value. */
  where?: { field: string; value: string };
  /** Only seq strictly above this one. */
  after?: number;
  /** Only seq strictly below this one. */
  before?: number;
  order?: 'asc' | 'desc';
  limit?: number;
};

export async function listDocs<T>(collection: string, o: ListOptions = {}): Promise<Doc<T>[]> {
  const args: unknown[] = [collection];
  const cond = ['collection = $1'];
  if (o.part !== undefined) {
    args.push(o.part);
    cond.push(`part = $${args.length}`);
  }
  if (o.where) {
    args.push(o.where.field, o.where.value);
    cond.push(`data ->> $${args.length - 1} = $${args.length}`);
  }
  if (o.after !== undefined) {
    args.push(o.after);
    cond.push(`seq > $${args.length}`);
  }
  if (o.before !== undefined) {
    args.push(o.before);
    cond.push(`seq < $${args.length}`);
  }
  args.push(Math.min(Math.max(o.limit ?? 200, 1), 1000));
  const r = await (await pool()).query(
    `select id, part, seq, data, created_at from net_docs where ${cond.join(' and ')}
     order by seq ${o.order === 'desc' ? 'desc' : 'asc'} limit $${args.length}`,
    args,
  );
  return r.rows.map((row: Row) => toDoc<T>(row));
}

export async function countDocs(collection: string, part: string): Promise<number> {
  const r = await (await pool()).query('select count(*)::int as n from net_docs where collection = $1 and part = $2', [collection, part]);
  return Number(r.rows[0].n);
}

/** Deletes a whole partition, or the documents whose data[field] equals value. */
export async function deleteWhere(collection: string, o: { part?: string; where?: { field: string; value: string } }): Promise<void> {
  const args: unknown[] = [collection];
  const cond = ['collection = $1'];
  if (o.part !== undefined) {
    args.push(o.part);
    cond.push(`part = $${args.length}`);
  }
  if (o.where) {
    args.push(o.where.field, o.where.value);
    cond.push(`data ->> $${args.length - 1} = $${args.length}`);
  }
  if (args.length === 1) throw new Error('deleteWhere: refusing to empty a collection');
  await (await pool()).query(`delete from net_docs where ${cond.join(' and ')}`, args);
}

/**
 * Counts one hit against `key` in a fixed window. Returns true while the
 * count stays within `limit`. Atomic, so parallel requests cannot slip past.
 */
export async function hit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const p = await pool();
  const r = await p.query(
    `insert into net_rate (key, count, reset_at) values ($1, 1, now() + make_interval(secs => $2))
     on conflict (key) do update set
       count = case when net_rate.reset_at <= now() then 1 else net_rate.count + 1 end,
       reset_at = case when net_rate.reset_at <= now() then excluded.reset_at else net_rate.reset_at end
     returning count`,
    [key, windowSec],
  );
  if (Math.random() < 0.02) await p.query('delete from net_rate where reset_at < now()');
  return Number(r.rows[0].count) <= limit;
}

/** Number of documents in each of several partitions, in one query. */
export async function countByPart(collection: string, parts: string[]): Promise<Map<string, number>> {
  if (parts.length === 0) return new Map();
  const r = await (await pool()).query(
    'select part, count(*)::int as n from net_docs where collection = $1 and part = any($2) group by part',
    [collection, parts],
  );
  return new Map(r.rows.map((row: { part: string; n: number }) => [row.part, Number(row.n)]));
}

/**
 * Merges `patch` into a document's data only if data[field] (a number) is
 * below `value` — so two messages sent at once cannot move a conversation's
 * last seq backwards.
 */
export async function patchIfAbove(collection: string, id: string, field: string, value: number, patch: Record<string, unknown>): Promise<void> {
  await (await pool()).query(
    `update net_docs set data = data || $4::jsonb
     where collection = $1 and id = $2 and coalesce((data ->> $3)::bigint, 0) < $5`,
    [collection, id, field, JSON.stringify(patch), value],
  );
}
