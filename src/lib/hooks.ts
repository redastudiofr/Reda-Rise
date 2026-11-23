'use client';

import { useEffect, useState } from 'react';
import { dayKey } from './dates';

/**
 * Clé du jour courant. Renvoie null au premier rendu (serveur + hydratation)
 * pour éviter tout décalage entre le HTML serveur et le client.
 * Se met à jour au retour sur l'app et au passage de minuit.
 */
export function useTodayKey(): string | null {
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setKey(dayKey(new Date()));
    refresh();

    document.addEventListener('visibilitychange', refresh);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const t = window.setTimeout(refresh, midnight.getTime() - now.getTime() + 50);

    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.clearTimeout(t);
    };
  }, []);

  return key;
}
