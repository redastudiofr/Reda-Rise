'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import XpBurst from '@/components/XpBurst';
import ClothingSheet, { type ClothingDraft } from '@/components/wardrobe/ClothingSheet';
import OrderSheet from '@/components/wardrobe/OrderSheet';
import { dayXp, todayKey, uid } from '@/lib/logic';
import type { ClothingItem, ClothingOrder } from '@/lib/types';
import { isLocked, orderedIds, ordersWithXp } from '@/lib/wardrobe';
import { levelFromXp, totalXpOf } from '@/lib/xp';

const euro = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

/** The clothing range: order a piece on its shop, confirm, earn XP. */
export default function WardrobePage() {
  const { data, update } = useData();
  const level = useMemo(() => levelFromXp(totalXpOf(data, dayXp)).level, [data]);
  const today = todayKey(data.settings.timezone);
  const [editing, setEditing] = useState<ClothingItem | 'new' | null>(null);
  const [viewing, setViewing] = useState<ClothingItem | null>(null);
  const [burst, setBurst] = useState<{ id: number; amount: number; title: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const ordered = orderedIds(data);
  const orders = useMemo(() => ordersWithXp(data.wardrobe.orders).reverse(), [data.wardrobe.orders]);
  const earned = orders.reduce((a, o) => a + o.xp, 0);
  const items = data.wardrobe.items
    .filter((i) => showArchived || !i.archived)
    .sort((a, b) => Number(isLocked(a, level)) - Number(isLocked(b, level)) || (a.minLevel ?? 0) - (b.minLevel ?? 0) || b.createdAt.localeCompare(a.createdAt));

  function saveItem(d: ClothingDraft) {
    if (editing === 'new') {
      const item: ClothingItem = { ...d, id: uid(), createdAt: new Date().toISOString() };
      update((x) => ({ ...x, wardrobe: { ...x.wardrobe, items: [item, ...x.wardrobe.items] } }));
    } else if (editing) {
      const id = editing.id;
      update((x) => ({ ...x, wardrobe: { ...x.wardrobe, items: x.wardrobe.items.map((i) => (i.id === id ? { ...i, ...d } : i)) } }));
      if (viewing?.id === id) setViewing({ ...editing, ...d });
    }
    setEditing(null);
  }

  function deleteItem(id: string) {
    // Orders stay: they are history, and keep the XP they earned.
    update((x) => ({ ...x, wardrobe: { ...x.wardrobe, items: x.wardrobe.items.filter((i) => i.id !== id) } }));
    setEditing(null);
    setViewing(null);
  }

  function confirmOrder(item: ClothingItem, size: string | undefined) {
    const first = !ordered.has(item.id);
    const order: ClothingOrder = {
      id: uid(),
      itemId: item.id,
      name: item.name,
      price: item.price,
      size,
      xp: item.xp,
      date: today,
      createdAt: new Date().toISOString(),
    };
    update((x) => ({ ...x, wardrobe: { ...x.wardrobe, orders: [...x.wardrobe.orders, order] } }));
    setViewing(null);
    if (first) setBurst({ id: Date.now(), amount: item.xp, title: `Commande confirmée : ${item.name}` });
  }

  function removeOrder(id: string) {
    update((x) => ({ ...x, wardrobe: { ...x.wardrobe, orders: x.wardrobe.orders.filter((o) => o.id !== id) } }));
  }

  const active = data.wardrobe.items.filter((i) => !i.archived);

  return (
    <div className="wr">
      {burst ? <XpBurst key={burst.id} amount={burst.amount} title={burst.title} label="Vêtements" /> : null}
      {editing ? (
        <ClothingSheet
          initial={editing === 'new' ? null : editing}
          onSave={saveItem}
          onDelete={() => editing !== 'new' && deleteItem(editing.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {viewing && !editing ? (
        <OrderSheet
          item={viewing}
          alreadyOrdered={ordered.has(viewing.id)}
          locked={isLocked(viewing, level)}
          onConfirm={(size) => confirmOrder(viewing, size)}
          onEdit={() => setEditing(viewing)}
          onClose={() => setViewing(null)}
        />
      ) : null}

      <header className="topbar">
        <div>
          <h1>Vêtements</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="wr-brand" src="/icons/reda-studio.png" alt="Reda Studio" width={1712} height={177} />
        </div>
        <button className="btn btn-accent btn-sm" onClick={() => setEditing('new')}>+ Ajouter</button>
      </header>

      <section className="wr-stats">
        <div className="card">
          <span>XP gagnée</span>
          <b className="mono">+{earned}</b>
        </div>
        <div className="card">
          <span>Commandes</span>
          <b className="mono">{orders.length}</b>
        </div>
        <div className="card">
          <span>Pièces</span>
          <b className="mono">{active.length}</b>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="card dash-empty">
          <b>Aucune pièce pour l’instant.</b>
          <span>Ajoute les vêtements de ta collection avec leur prix, leurs tailles, leur lien de commande et l’XP qu’ils rapportent.</span>
          <button className="btn btn-accent" style={{ marginTop: 10 }} onClick={() => setEditing('new')}>Ajouter une pièce</button>
        </div>
      ) : (
        <div className="wr-grid">
          {items.map((i) => {
            const locked = isLocked(i, level);
            const done = ordered.has(i.id);
            return (
              <button key={i.id} className="card wr-card" data-locked={locked} data-archived={i.archived} onClick={() => setViewing(i)}>
                <span className="wr-img">
                  {i.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.photo} alt="" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M8.5 3.5 4 6l-1.5 4.5 3 1.2V20.5h13V11.7l3-1.2L20 6l-4.5-2.5" />
                      <path d="M8.5 3.5a3.5 3 0 0 0 7 0" />
                    </svg>
                  )}
                  {locked ? <span className="wr-lock">Niveau {i.minLevel}</span> : i.minLevel ? <span className="wr-excl">Exclusif</span> : null}
                </span>
                <span className="wr-name">{i.name}</span>
                <span className="wr-meta">
                  <b className="mono">{euro(i.price)}</b>
                  <span className="xp-chip" data-spent={done}>{done ? '✓ commandé' : `+${i.xp} XP`}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {data.wardrobe.items.some((i) => i.archived) ? (
        <button className="link-sm" style={{ marginTop: 10 }} onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? 'Masquer les pièces archivées' : 'Voir les pièces archivées'}
        </button>
      ) : null}

      {orders.length > 0 ? (
        <section className="section">
          <h2 className="section-title">Mes commandes</h2>
          <ul className="card wr-orders">
            {orders.map((o) => (
              <li key={o.id}>
                <span>
                  <b>{o.name}</b>
                  <small>
                    {new Date(`${o.date}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {o.size ? ` · ${o.size}` : ''} · {euro(o.price)}
                  </small>
                </span>
                <span className="wr-order-side">
                  {o.xp > 0 ? <span className="xp-chip">+{o.xp} XP</span> : null}
                  <button className="link-sm" aria-label={`Annuler la commande ${o.name}`} onClick={() => removeOrder(o.id)}>Retirer</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
