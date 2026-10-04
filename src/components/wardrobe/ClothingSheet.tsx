'use client';

import { useState } from 'react';
import { dataUrlBytes, resizeToDataUrl } from '@/lib/image';
import type { ClothingItem } from '@/lib/types';
import { CLOTHING_XP, SHOP_URL, SIZES, clampClothingXp, safeOrderUrl, safePhoto, suggestClothingXp } from '@/lib/wardrobe';

export type ClothingDraft = Omit<ClothingItem, 'id' | 'createdAt'>;

const MAX_PHOTO = 160_000;

/** Add or edit a piece: price, sizes, shop link, the XP it earns, an optional level to unlock it. */
export default function ClothingSheet({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial: ClothingItem | null;
  onSave: (d: ClothingDraft) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [xp, setXp] = useState(initial ? String(initial.xp) : '');
  const [xpTouched, setXpTouched] = useState(Boolean(initial));
  const [sizes, setSizes] = useState<string[]>(initial?.sizes?.length ? initial.sizes : ['S', 'M', 'L', 'XL']);
  const sizeChoices = [...SIZES, ...sizes.filter((s) => !SIZES.includes(s))];
  const [url, setUrl] = useState(initial?.orderUrl ?? '');
  const [minLevel, setMinLevel] = useState(initial?.minLevel ? String(initial.minLevel) : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [photo, setPhoto] = useState(initial?.photo ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const p = Number(price.replace(/\s/g, '').replace(',', '.'));
  const shownXp = xpTouched ? xp : Number.isFinite(p) && p > 0 ? String(suggestClothingXp(p)) : '';

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let out = await resizeToDataUrl(file, { max: 520, quality: 0.8 });
    if (out && dataUrlBytes(out) > MAX_PHOTO) out = await resizeToDataUrl(file, { max: 380, quality: 0.7 });
    if (!out || dataUrlBytes(out) > MAX_PHOTO) return setError('Photo illisible ou trop lourde.');
    setError(null);
    setPhoto(out);
  }

  function save() {
    if (!name.trim()) return setError('Donne un nom à la pièce.');
    if (!Number.isFinite(p) || p < 0) return setError('Prix invalide.');
    if (sizes.length === 0) return setError('Choisis au moins une taille.');
    const link = safeOrderUrl(url);
    if (!link) return setError('Seules les pièces de redastudio.fr sont acceptées : colle le lien de la pièce sur redastudio.fr.');
    const lvl = minLevel.trim() ? Math.round(Number(minLevel)) : undefined;
    if (lvl !== undefined && (!Number.isFinite(lvl) || lvl < 1 || lvl > 100)) return setError('Niveau requis : entre 1 et 100.');
    onSave({
      name: name.trim().slice(0, 60),
      price: Math.round(p * 100) / 100,
      xp: clampClothingXp(shownXp || suggestClothingXp(p)),
      sizes: sizeChoices.filter((s) => sizes.includes(s)),
      orderUrl: link,
      shopId: initial?.shopId,
      minLevel: lvl && lvl > 1 ? lvl : undefined,
      description: description.trim().slice(0, 400) || undefined,
      photo: photo || undefined,
      archived: initial?.archived,
    });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet wr-sheet" role="dialog" aria-label="Vêtement" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{initial ? 'Modifier la pièce' : 'Nouvelle pièce'}</div>

        <div className="wr-photo-row">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="wr-photo-preview" src={safePhoto(photo)} alt="" />
          ) : (
            <span className="wr-photo-preview wr-photo-empty" aria-hidden />
          )}
          <div className="wr-photo-actions">
            <label className="btn btn-ghost btn-sm">
              {photo ? 'Changer la photo' : 'Ajouter une photo'}
              <input type="file" accept="image/*" hidden onChange={pick} />
            </label>
            {photo ? <button type="button" className="link-sm" onClick={() => setPhoto('')}>Retirer</button> : null}
          </div>
        </div>

        <label className="field">
          <span>Nom</span>
          <input className="input" value={name} maxLength={60} placeholder="Hoodie Reda Studio" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Prix (€)</span>
            <input className="input mono" inputMode="decimal" value={price} placeholder="59" onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="field">
            <span>XP gagnée ({CLOTHING_XP.min}–{CLOTHING_XP.max})</span>
            <input
              className="input mono"
              inputMode="numeric"
              value={shownXp}
              placeholder="30"
              onChange={(e) => {
                setXpTouched(true);
                setXp(e.target.value.replace(/\D/g, ''));
              }}
              onBlur={() => xpTouched && xp && setXp(String(clampClothingXp(xp)))}
            />
          </label>
        </div>
        <div className="field">
          <span>Tailles disponibles</span>
          <div className="chip-grid">
            {sizeChoices.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                data-on={sizes.includes(s)}
                aria-pressed={sizes.includes(s)}
                onClick={() => setSizes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Lien de la pièce sur redastudio.fr</span>
          <input className="input" type="url" inputMode="url" value={url} placeholder={`${SHOP_URL}/products/…`} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="field">
          <span>Pièce exclusive : niveau requis (facultatif)</span>
          <input className="input mono" inputMode="numeric" value={minLevel} placeholder="Ex. 10" onChange={(e) => setMinLevel(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="field">
          <span>Description (facultatif)</span>
          <textarea className="input" rows={3} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <p className="hint">L’XP est gagnée une seule fois par pièce, à sa première commande.</p>

        {error ? <div className="banner warn" role="alert">{error}</div> : null}
        <div className="ag-sheet-actions">
          {initial ? (
            confirmDelete ? (
              <button className="btn btn-ghost ag-del-btn" onClick={onDelete}>Confirmer</button>
            ) : (
              <button className="btn btn-ghost ag-del-btn" onClick={() => setConfirmDelete(true)}>Supprimer</button>
            )
          ) : null}
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-accent" onClick={save}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
