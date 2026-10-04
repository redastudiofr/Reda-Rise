'use client';

import { useState } from 'react';
import { ASSET_TYPES } from '@/lib/invest';
import type { AssetType, Holding } from '@/lib/types';

export type HoldingDraft = {
  name: string;
  type: AssetType;
  symbol?: string;
  quantity: number;
  buyPrice: number;
  currentPrice?: number;
  fees?: number;
  date: string;
  note?: string;
};

function num(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Add or edit one position. Only the name, quantity and price are required. */
export default function HoldingSheet({
  initial,
  today,
  onSave,
  onClose,
}: {
  initial?: Holding | null;
  today: string;
  onSave: (draft: HoldingDraft) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<AssetType>(initial?.type ?? 'action');
  const [symbol, setSymbol] = useState(initial?.symbol ?? '');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '1');
  const [buyPrice, setBuyPrice] = useState(initial ? String(initial.buyPrice) : '');
  const [currentPrice, setCurrentPrice] = useState(
    typeof initial?.currentPrice === 'number' ? String(initial.currentPrice) : '',
  );
  const [fees, setFees] = useState(initial?.fees ? String(initial.fees) : '');
  const [date, setDate] = useState(initial?.date ?? today);
  const [note, setNote] = useState(initial?.note ?? '');

  const quantityNum = num(quantity);
  const buyNum = num(buyPrice);
  const valid =
    name.trim() !== '' &&
    quantityNum !== null &&
    quantityNum > 0 &&
    buyNum !== null &&
    buyNum >= 0;

  function submit() {
    if (!valid || quantityNum === null || buyNum === null) return;
    const current = currentPrice.trim() === '' ? null : num(currentPrice);
    const feesNum = fees.trim() === '' ? null : num(fees);
    onSave({
      name: name.trim(),
      type,
      symbol: symbol.trim() || undefined,
      quantity: quantityNum,
      buyPrice: buyNum,
      currentPrice: current !== null && current >= 0 ? current : undefined,
      fees: feesNum !== null && feesNum > 0 ? feesNum : undefined,
      date: date || today,
      note: note.trim() || undefined,
    });
  }

  const isProperty = type === 'immobilier';

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        <div className="sheet-title">{initial ? 'Modifier la position' : 'Nouvel investissement'}</div>

        <input
          className="input"
          placeholder="Nom — MSCI World, Bitcoin, studio Lyon…"
          maxLength={48}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="field">
          <span>Type</span>
          <div className="chip-grid">
            {ASSET_TYPES.map((t) => (
              <button key={t.id} className="chip" data-on={type === t.id} onClick={() => setType(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <label className="field">
            <span>{isProperty ? 'Nombre de biens' : 'Quantité'}</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{isProperty ? 'Prix d’achat' : 'Prix unitaire'}</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="0"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
            />
          </label>
        </div>

        <div className="grid-2">
          <label className="field">
            <span>Valeur actuelle (unité)</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="Facultatif"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Frais</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="Facultatif"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
            />
          </label>
        </div>

        <div className="grid-2">
          <label className="field">
            <span>Date d’investissement</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Symbole</span>
            <input
              className="input"
              placeholder="Facultatif"
              maxLength={16}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>Note</span>
          <input
            className="input"
            placeholder="Facultatif"
            maxLength={80}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="hint" style={{ marginTop: 12 }}>
          Sans valeur actuelle, la position reste comptée à son prix d’achat : la plus-value
          affichée est alors nulle plutôt qu’estimée.
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-accent" onClick={submit} disabled={!valid}>
            {initial ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
