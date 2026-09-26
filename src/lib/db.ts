import type { Pool } from 'pg';
import type { AppData, PushSub } from './types';
import { defaultData, normalizeData } from './program';

/**
 * Storage layer.
 *
 * With POSTGRES_URL / DATABASE_URL set (Vercel Postgres, Neon, Supabase…) every
 * write is durable and survives a reinstall of the app. Without it the app still
 * runs on an in-memory store so a fresh deploy works out of the box — that data
 * is lost whenever the serverless instance is recycled.
 */

function connectionString(): string {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    ''
  );
}

export function hasDatabase(): boolean {
  return connectionString().length > 0;
}

/** One row of the shared leaderboard. Nothing personal beyond the pseudo. */
export type LeaderboardRow = {
  playerId: string;
  pseudo: string;
  xp: number;
  level: number;
  streak: number;
  updatedAt: string;
};

type MemoryStore = {
  data: AppData | null;
  subs: Map<string, PushSub>;
  sent: Set<string>;
  board: Map<string, LeaderboardRow>;
  pool: Pool | null;
  ready: Promise<void> | null;
};

const globalRef = globalThis as unknown as { __muscu?: MemoryStore };
const mem: MemoryStore =
  globalRef.__muscu ??
  (globalRef.__muscu = {
    data: null,
    subs: new Map(),
    sent: new Set(),
    board: new Map(),
    pool: null,
    ready: null,
  });

async function getPool(): Promise<Pool | null> {
  const cs = connectionString();
  if (!cs) return null;
  if (mem.pool) return mem.pool;
  const { Pool: PgPool } = await import('pg');
  const local = /@(localhost|127\.0\.0\.1)/.test(cs) || cs.includes('sslmode=disable');
  mem.pool = new PgPool({
    connectionString: cs,
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10_000,
  });
  return mem.pool;
}

async function ensureSchema(pool: Pool): Promise<void> {
  const pending = mem.ready;
  if (pending) return pending;

  const ready = (async () => {
    await pool.query(`
      create table if not exists app_state (
        id int primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create table if not exists push_subs (
        endpoint text primary key,
        sub jsonb not null,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create table if not exists notif_log (
        key text primary key,
        sent_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create table if not exists leaderboard (
        player_id text primary key,
        pseudo text not null,
        xp integer not null default 0,
        level integer not null default 1,
        streak integer not null default 0,
        updated_at timestamptz not null default now()
      );
    `);
  })();

  mem.ready = ready;
  try {
    await ready;
  } catch (err) {
    // Let the next call retry instead of caching a failed migration.
    mem.ready = null;
    throw err;
  }
}

/* ---------- app data ---------- */

/**
 * Reads the stored state, and reports whether anything was actually stored.
 * `stored: false` means the server is starting from scratch — the client must
 * then keep its own copy rather than adopt this empty one.
 */
export async function readState(): Promise<{ data: AppData; stored: boolean }> {
  const pool = await getPool();
  if (!pool) {
    if (mem.data) return { data: mem.data, stored: true };
    return { data: defaultData(), stored: false };
  }
  await ensureSchema(pool);
  const res = await pool.query('select data from app_state where id = 1');
  if (res.rows.length === 0) return { data: defaultData(), stored: false };
  return { data: normalizeData(res.rows[0].data), stored: true };
}

export async function readData(): Promise<AppData> {
  return (await readState()).data;
}

export async function writeData(data: AppData): Promise<AppData> {
  const clean = normalizeData({ ...data, updatedAt: Date.now() });
  const pool = await getPool();
  if (!pool) {
    mem.data = clean;
    return clean;
  }
  await ensureSchema(pool);
  await pool.query(
    `insert into app_state (id, data, updated_at) values (1, $1, now())
     on conflict (id) do update set data = excluded.data, updated_at = now()`,
    [JSON.stringify(clean)],
  );
  return clean;
}

/* ---------- push subscriptions ---------- */

export async function listSubs(): Promise<PushSub[]> {
  const pool = await getPool();
  if (!pool) return [...mem.subs.values()];
  await ensureSchema(pool);
  const res = await pool.query('select sub from push_subs');
  return res.rows.map((r) => r.sub as PushSub);
}

export async function addSub(sub: PushSub): Promise<void> {
  const pool = await getPool();
  if (!pool) {
    mem.subs.set(sub.endpoint, sub);
    return;
  }
  await ensureSchema(pool);
  await pool.query(
    `insert into push_subs (endpoint, sub) values ($1, $2)
     on conflict (endpoint) do update set sub = excluded.sub`,
    [sub.endpoint, JSON.stringify(sub)],
  );
}

export async function removeSub(endpoint: string): Promise<void> {
  const pool = await getPool();
  if (!pool) {
    mem.subs.delete(endpoint);
    return;
  }
  await ensureSchema(pool);
  await pool.query('delete from push_subs where endpoint = $1', [endpoint]);
}

/* ---------- notification de-duplication ---------- */

export async function alreadySent(key: string): Promise<boolean> {
  const pool = await getPool();
  if (!pool) return mem.sent.has(key);
  await ensureSchema(pool);
  const res = await pool.query('select 1 from notif_log where key = $1', [key]);
  return res.rows.length > 0;
}

export async function markSent(key: string): Promise<void> {
  const pool = await getPool();
  if (!pool) {
    mem.sent.add(key);
    return;
  }
  await ensureSchema(pool);
  await pool.query('insert into notif_log (key) values ($1) on conflict do nothing', [key]);
  await pool.query(`delete from notif_log where sent_at < now() - interval '10 days'`);
}

/* ---------- classement partagé ---------- */

/**
 * Every player who chose to publish, best first. Without a database this lives
 * in the process memory only, so the board is empty again after a restart —
 * the UI says so rather than showing stale rows.
 */
export async function listLeaderboard(): Promise<LeaderboardRow[]> {
  const pool = await getPool();
  if (!pool) {
    return [...mem.board.values()].sort((a, b) => b.xp - a.xp);
  }
  await ensureSchema(pool);
  const res = await pool.query(
    'select player_id, pseudo, xp, level, streak, updated_at from leaderboard order by xp desc limit 100',
  );
  return res.rows.map((r) => ({
    playerId: r.player_id as string,
    pseudo: r.pseudo as string,
    xp: Number(r.xp),
    level: Number(r.level),
    streak: Number(r.streak),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

export async function publishToLeaderboard(row: Omit<LeaderboardRow, 'updatedAt'>): Promise<void> {
  const pool = await getPool();
  if (!pool) {
    mem.board.set(row.playerId, { ...row, updatedAt: new Date().toISOString() });
    return;
  }
  await ensureSchema(pool);
  await pool.query(
    `insert into leaderboard (player_id, pseudo, xp, level, streak, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (player_id) do update set
       pseudo = excluded.pseudo,
       xp = excluded.xp,
       level = excluded.level,
       streak = excluded.streak,
       updated_at = now()`,
    [row.playerId, row.pseudo, row.xp, row.level, row.streak],
  );
}

/** Called when the user turns sharing off — the row goes away for good. */
export async function removeFromLeaderboard(playerId: string): Promise<void> {
  const pool = await getPool();
  if (!pool) {
    mem.board.delete(playerId);
    return;
  }
  await ensureSchema(pool);
  await pool.query('delete from leaderboard where player_id = $1', [playerId]);
}
