'use client';

import { useEffect, useState } from 'react';

/** Message bref en haut de l'écran. `message` change => le toast se rejoue. */
export function Toast({ message }: { message: string | null }) {
  const [shown, setShown] = useState<{ text: string; id: number } | null>(null);

  useEffect(() => {
    if (!message) return;
    const id = Date.now();
    setShown({ text: message, id });
    const t = window.setTimeout(() => setShown((s) => (s?.id === id ? null : s)), 2600);
    return () => window.clearTimeout(t);
  }, [message]);

  if (!shown) return null;
  return (
    <div key={shown.id} className="toast" role="status">
      {shown.text}
    </div>
  );
}
