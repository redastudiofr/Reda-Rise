'use client';

import { useRef, useState } from 'react';
import { dataUrlBytes, resizeToDataUrl } from '@/lib/image';

/** Photos are resized to this before storage — plenty to see, small to sync. */
const MAX_SIDE = 720;
const MAX_BYTES = 900_000;

/**
 * Asks for the photo that proves an objective was done, then hands it back.
 * The picture is resized on the device and never leaves it beyond the app's
 * own sync.
 */
export default function PhotoProof({
  title,
  onConfirm,
  onClose,
}: {
  title: string;
  onConfirm: (photo: string) => void;
  onClose: () => void;
}) {
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError('');
    try {
      const dataUrl = await resizeToDataUrl(file, { max: MAX_SIDE });
      if (!dataUrl) {
        setError('Cette image n’a pas pu être lue. Essaie une autre photo.');
        return;
      }
      if (dataUrlBytes(dataUrl) > MAX_BYTES) {
        const smaller = await resizeToDataUrl(file, { max: 480, quality: 0.7 });
        setPhoto(smaller || dataUrl);
      } else {
        setPhoto(dataUrl);
      }
    } catch {
      setError('Impossible de traiter cette photo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        <div className="sheet-title">Valider l’objectif</div>
        <div className="ex-meta" style={{ marginBottom: 14 }}>
          {title}
        </div>

        {photo ? (
          <div className="proof-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Photo de validation" />
          </div>
        ) : (
          <div className="proof-empty">
            {busy ? 'Traitement de la photo…' : 'Ajoute une photo qui montre l’objectif réalisé.'}
          </div>
        )}

        {error ? <div className="banner warn">{error}</div> : null}

        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPick}
          hidden
        />
        <input ref={library} type="file" accept="image/*" onChange={onPick} hidden />

        <div className="money-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => camera.current?.click()} disabled={busy}>
            Prendre une photo
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => library.current?.click()} disabled={busy}>
            Choisir une photo
          </button>
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-accent"
            onClick={() => photo && onConfirm(photo)}
            disabled={!photo || busy}
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
