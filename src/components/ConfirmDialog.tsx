'use client';

import { useEffect } from 'react';

/**
 * Small confirmation asked before anything is deleted for good. Same bottom
 * sheet language as the rest of the app, kept to a question and two buttons.
 */
export default function ConfirmDialog({
  title,
  detail,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  onConfirm,
  onClose,
}: {
  title: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet confirm-sheet"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sheet-grip" />
        <div className="sheet-title" style={{ marginBottom: detail ? 6 : 14 }}>
          {title}
        </div>
        {detail ? <div className="ex-meta" style={{ marginBottom: 14 }}>{detail}</div> : null}
        <div className="grid-2">
          <button className="btn btn-ghost" onClick={onClose}>
            {cancelLabel}
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
