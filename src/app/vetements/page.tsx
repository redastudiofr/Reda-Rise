'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import XpBurst from '@/components/XpBurst';
import ClothingSheet, { type ClothingDraft } from '@/components/wardrobe/ClothingSheet';
import OrderSheet from '@/components/wardrobe/OrderSheet';
import { dayXp, todayKey, uid } from '@/lib/logic';
import type { ClothingItem, ClothingOrder } from '@/lib/types';
import type { ShopProduct } from '@/lib/shop';
import { SHOP_URL, isLocked, orderedIds, ordersWithXp, safePhoto, suggestClothingXp } from '@/lib/wardrobe';
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
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /** Brings in the redastudio.fr catalogue: new pieces are added, known ones updated (XP and level kept). */
  async function importShop() {
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch('/api/shop/catalog', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { products?: ShopProduct[]; error?: string };
      if (!res.ok || !json.products) throw new Error(json.error ?? 'Import impossible.');
      const products = json.products;
      const merge = (list: ClothingItem[]) => {
        const items = [...list];
        let added = 0;
        let updated = 0;
        for (const p of products) {
          const i = items.findIndex((it) => it.shopId === p.shopId || it.orderUrl === p.orderUrl);
          const fields = { name: p.name, price: p.price, photo: p.photo, sizes: p.sizes, orderUrl: p.orderUrl, description: p.description, shopId: p.shopId };
          if (i >= 0) {
            items[i] = { ...items[i], ...fields };
            updated++;
          } else {
            items.push({ ...fields, id: `shop-${p.shopId}`, xp: suggestClothingXp(p.price), createdAt: new Date().toISOString() });
            added++;
          }
        }
        return { items, added, updated };
      };
      const { added, updated } = merge(data.wardrobe.items);
      update((x) => ({ ...x, wardrobe: { ...x.wardrobe, items: merge(x.wardrobe.items).items } }));
      setImportMsg({ ok: true, text: products.length ? `${added} pièce${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}, ${updated} mise${updated > 1 ? 's' : ''} à jour depuis redastudio.fr.` : 'La boutique ne publie aucune pièce pour l’instant.' });
    } catch (e) {
      setImportMsg({ ok: false, text: (e as Error).message });
    }
    setImporting(false);
  }

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
          <a href={SHOP_URL} target="_blank" rel="noopener noreferrer" className="wr-shop-link" aria-label="Ouvrir redastudio.fr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="wr-brand" src="/icons/reda-studio.png" alt="Reda Studio" width={1712} height={177} />
            <span>redastudio.fr ↗</span>
          </a>
        </div>
        <button className="btn btn-accent btn-sm" onClick={() => setEditing('new')}>+ Ajouter</button>
      </header>

      <div className="wr-import">
        <button className="btn btn-ghost btn-sm" onClick={importShop} disabled={importing}>
          {importing ? 'Import en cours…' : 'Importer la collection de redastudio.fr'}
        </button>
        {importMsg ? (
          <div className={importMsg.ok ? 'banner' : 'banner warn'} role="status">
            {importMsg.text}
          </div>
        ) : null}
      </div>

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
          <span>Importe la collection de redastudio.fr, ou ajoute une pièce avec son lien redastudio.fr, ses tailles et l’XP qu’elle rapporte.</span>
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
                  {safePhoto(i.photo) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={safePhoto(i.photo)} alt="" loading="lazy" />
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
