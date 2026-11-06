import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { env } from './env';

/**
 * A tiny key-value store. With DATABASE_URL (Neon / Vercel Postgres, free
 * tier) it lives in one table; otherwise in .data/store.json, which is fine
 * on your computer but is wiped between Vercel deployments.
 */
type Backend = { get(key: string): Promise<string | null>; set(key: string, value: string | null): Promise<void> };

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

const pg: Backend = {
  async get(key) {
    await init();
    const r = await pool!.query<{ value: string }>('select value from jarvis_kv where key = $1', [key]);
    return r.rows[0]?.value ?? null;
  },
  async set(key, value) {
    await init();
    if (value === null) await pool!.query('delete from jarvis_kv where key = $1', [key]);
    else
      await pool!.query(
        'insert into jarvis_kv(key, value, updated_at) values ($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()',
        [key, value],
      );
  },
};

function init(): Promise<void> {
  if (!pool) {
    const url = env.databaseUrl();
    pool = new Pool({ connectionString: url, max: 3, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  }
  ready ??= pool
    .query('create table if not exists jarvis_kv (key text primary key, value text not null, updated_at timestamptz not null default now())')
    .then(() => undefined)
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

const FILE = path.join(process.cwd(), '.data', 'store.json');
let chain: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(FILE, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

const file: Backend = {
  async get(key) {
    return (await readAll())[key] ?? null;
  },
  set(key, value) {
    // Writes are serialised so two saves cannot lose each other.
    const next = chain.then(async () => {
      const all = await readAll();
      if (value === null) delete all[key];
      else all[key] = value;
      await mkdir(path.dirname(FILE), { recursive: true });
      await writeFile(FILE, JSON.stringify(all, null, 2), { mode: 0o600 });
    });
    chain = next.catch(() => undefined);
    return next;
  },
};

const backend = (): Backend => (env.databaseUrl() ? pg : file);

export const durable = () => Boolean(env.databaseUrl()) || !process.env.VERCEL;

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await backend().get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await backend().set(key, value === null ? null : JSON.stringify(value));
}
