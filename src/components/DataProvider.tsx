'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AppData } from '@/lib/types';
import { defaultData, normalizeData } from '@/lib/program';

const STORAGE_KEY = 'muscu-data-v1';

type Status = 'loading' | 'ready' | 'local';

type Ctx = {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  status: Status;
  durable: boolean;
  pending: boolean;
  authOn: boolean;
};

const DataContext = createContext<Ctx | null>(null);

export function useData(): Ctx {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans DataProvider');
  return ctx;
}

function readLocal(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota or private mode — the server copy still holds */
  }
}

export default function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(defaultData);
  const [status, setStatus] = useState<Status>('loading');
  const [durable, setDurable] = useState(false);
  const [pending, setPending] = useState(false);
  const [authOn, setAuthOn] = useState(false);
  const latest = useRef<AppData>(data);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushToServer = useCallback(async (payload: AppData) => {
    try {
      const res = await fetch('/api/data', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { durable?: boolean; auth?: boolean };
      setDurable(Boolean(json.durable));
      setAuthOn(Boolean(json.auth));
      setPending(false);
      setStatus('ready');
    } catch {
      // Offline or server down: the local copy is authoritative until we sync.
      setPending(true);
      setStatus('local');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const local = readLocal();
    if (local) {
      latest.current = local;
      setData(local);
    }

    (async () => {
      try {
        const res = await fetch('/api/data', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as {
          data: unknown;
          durable?: boolean;
          auth?: boolean;
          stored?: boolean;
        };
        if (cancelled) return;
        const server = normalizeData(json.data);
        setDurable(Boolean(json.durable));
        setAuthOn(Boolean(json.auth));
        if (local && json.stored === false) {
          // The server has nothing stored yet — never let its empty defaults
          // overwrite what this device already holds. Restore it upstream.
          await pushToServer(local);
        } else if (!local || server.updatedAt >= local.updatedAt) {
          latest.current = server;
          setData(server);
          writeLocal(server);
          setStatus('ready');
        } else {
          // Local edits made while offline win; send them up.
          await pushToServer(local);
        }
      } catch {
        if (!cancelled) setStatus('local');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pushToServer]);

  useEffect(() => {
    const onOnline = () => void pushToServer(latest.current);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [pushToServer]);

  const update = useCallback(
    (fn: (d: AppData) => AppData) => {
      const next: AppData = { ...fn(latest.current), version: 1, updatedAt: Date.now() };
      latest.current = next;
      setData(next);
      writeLocal(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void pushToServer(latest.current), 700);
    },
    [pushToServer],
  );

  return (
    <DataContext.Provider value={{ data, update, status, durable, pending, authOn }}>
      {children}
    </DataContext.Provider>
  );
}
