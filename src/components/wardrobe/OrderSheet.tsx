'use client';

import { useState } from 'react';
import type { ClothingItem } from '@/lib/types';
import { safeOrderUrl } from '@/lib/wardrobe';

/**
 * Ordering a piece: the shop opens in a new tab, then the user confirms the
 * order here. XP is earned once per piece, on its first confirmed order.
 */
export default function OrderSheet({
  item,
  alreadyOrdered,
  locked,
  onConfirm,
  onEdit,
  onClose,
}: {
  item: ClothingItem;
  alreadyOrdered: boolean;
  locked: boolean;
  onConfirm: (size: string | undefined) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [size, setSize] = useState<string | undefined>(item.sizes.length === 1 ? item.sizes[0] : undefined);
  const [opened, setOpened] = useState(false);
  const url = safeOrderUrl(item.orderUrl);
  const needsSize = item.sizes.length > 1 && !size;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet wr-sheet" role="dialog" aria-label={item.name} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {item.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="wr-order-photo" src={item.photo} alt={item.name} />
        ) : null}
        <div className="wr-order-head">
          <div>
            <div className="sheet-title" style={{ margin: 0 }}>{item.name}</div>
            <b className="mono">{item.price.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</b>
          </div>
          <span className="xp-chip" data-spent={alreadyOrdered}>{alreadyOrdered ? 'XP déjà gagnée' : `+${item.xp} XP`}</span>
        </div>
        {item.description ? <p className="wr-desc">{item.description}</p> : null}

        {locked ? (
          <div className="banner">Pièce exclusive : commandable à partir du niveau {item.minLevel}.</div>
        ) : (
          <>
            {item.sizes.length > 1 ? (
              <div className="field">
                <span>Taille</span>
                <div className="chip-grid" role="radiogroup" aria-label="Taille">
                  {item.sizes.map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={size === s} className="chip" data-on={size === s} onClick={() => setSize(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {url ? (
              <a
                className="btn btn-accent wr-shop"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={needsSize}
                onClick={(e) => {
                  if (needsSize) return e.preventDefault();
                  setOpened(true);
                }}
              >
                {needsSize ? 'Choisis ta taille' : 'Commander sur la boutique'}
              </a>
            ) : (
              <div className="banner warn">
                Pas encore de lien de commande pour cette pièce.{' '}
                <button type="button" className="link-sm" onClick={onEdit}>Ajouter le lien</button>
              </div>
            )}

            {url ? (
              <>
                <p className="hint">
                  {opened
                    ? 'Une fois ta commande passée sur la boutique, confirme-la ici.'
                    : 'La boutique s’ouvre dans un nouvel onglet. Reviens ensuite confirmer ta commande.'}
                </p>
                <button className="btn btn-ghost" disabled={needsSize} onClick={() => onConfirm(size)}>
                  J’ai passé commande{alreadyOrdered ? '' : ` · +${item.xp} XP`}
                </button>
              </>
            ) : null}
          </>
        )}
        <div className="ag-sheet-actions">
          <button className="btn btn-ghost" onClick={onEdit}>Modifier la pièce</button>
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
