'use client';

import { useEffect, useState } from 'react';
import Avatar from '../Avatar';
import { api } from '@/lib/network/client';
import { dataUrlBytes, resizeToDataUrl } from '@/lib/image';
import { CITIES, REGIONS } from '@/lib/network/places';
import type { Precision, ProfileDoc } from '@/lib/network/types';
import { LIMITS, SECTORS, validateProfile } from '@/lib/network/validate';
import { useNet } from './NetContext';
import TagInput from './TagInput';

type Draft = Omit<ProfileDoc, 'photoV' | 'updatedAt'>;

const EMPTY: Draft = {
  pseudo: '',
  company: '',
  sector: '',
  skills: [],
  interests: [],
  cityId: '',
  precision: 'ville',
  bio: '',
  visible: true,
  openToMessages: true,
};

/** The member's public profile. Also the first screen after sign-up. */
export default function ProfileEditor({ firstTime = false, onSaved }: { firstTime?: boolean; onSaved?: () => void }) {
  const { member, setMember } = useNet();
  const [draft, setDraft] = useState<Draft | null>(firstTime ? EMPTY : null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (firstTime) return;
    api<{ profile: ProfileDoc | null }>('/profile')
      .then(({ profile }) => {
        if (!profile) return setDraft(EMPTY);
        const { photoV, updatedAt, ...rest } = profile;
        void updatedAt;
        setDraft(rest);
        if (photoV && member) setPhoto(`/api/network/photo/${member.id}?v=${photoV}`);
      })
      .catch((e: Error) => setError(e.message));
  }, [firstTime, member]);

  if (!draft) return error ? <div className="banner warn">{error}</div> : <div className="empty">Chargement…</div>;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setSaved(false);
    setDraft({ ...draft, [k]: v });
  };

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let url = await resizeToDataUrl(file, { max: 320, square: true, quality: 0.82 });
    if (url && dataUrlBytes(url) > LIMITS.photoBytes) url = await resizeToDataUrl(file, { max: 240, square: true, quality: 0.7 });
    if (!url) return setError('Image illisible.');
    setError(null);
    setSaved(false);
    setNewPhoto(url);
  }

  async function removePhoto() {
    setBusy(true);
    try {
      await api('/profile/photo', { method: 'DELETE' });
      setPhoto(null);
      setNewPhoto(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function save() {
    if (!draft) return;
    const check = validateProfile(draft);
    if (!check.ok) return setError(check.error);
    setBusy(true);
    setError(null);
    try {
      await api('/profile', { method: 'PUT', body: draft });
      if (newPhoto) {
        const r = await api<{ photo: string }>('/profile/photo', { method: 'PUT', body: { photo: newPhoto } });
        setPhoto(r.photo);
        setNewPhoto(null);
      }
      if (member && !member.hasProfile) setMember({ ...member, hasProfile: true });
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const shown = newPhoto ?? photo;

  return (
    <div className={firstTime ? 'net' : undefined}>
      {firstTime ? (
        <header className="topbar">
          <div>
            <h1>Ton profil</h1>
            <p className="sub">Ce que les autres entrepreneurs verront de toi</p>
          </div>
        </header>
      ) : null}
      <div className="card net-form">
        <div className="net-photo-row">
          <Avatar src={shown ?? undefined} name={draft.pseudo} size={72} />
          <div className="net-photo-actions">
            <label className="btn btn-ghost btn-sm">
              {shown ? 'Changer la photo' : 'Ajouter une photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
            </label>
            {photo && !newPhoto ? (
              <button type="button" className="link-sm" onClick={removePhoto} disabled={busy}>Retirer</button>
            ) : null}
          </div>
        </div>

        <label className="field">
          <span>Prénom ou pseudo</span>
          <input className="input" value={draft.pseudo} maxLength={LIMITS.pseudo} onChange={(e) => set('pseudo', e.target.value)} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Entreprise</span>
            <input className="input" value={draft.company} maxLength={LIMITS.company} placeholder="Reda Studio" onChange={(e) => set('company', e.target.value)} />
          </label>
          <label className="field">
            <span>Secteur</span>
            <select className="input" value={draft.sector} onChange={(e) => set('sector', e.target.value)}>
              <option value="">Choisir…</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <TagInput label="Compétences" value={draft.skills} onChange={(v) => set('skills', v)} placeholder="Ex. vente, design, levée de fonds" />
        <TagInput label="Centres d’intérêt professionnels" value={draft.interests} onChange={(v) => set('interests', v)} placeholder="Ex. IA, immobilier, export" />

        <label className="field">
          <span>Grande ville la plus proche</span>
          <select className="input" value={draft.cityId} onChange={(e) => set('cityId', e.target.value)}>
            <option value="">Choisir…</option>
            {REGIONS.map((r) => (
              <optgroup key={r.id} label={r.name}>
                {CITIES.filter((c) => c.region === r.id)
                  .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Afficher</span>
          <div className="segmented" role="radiogroup" aria-label="Précision du lieu">
            {(['ville', 'region'] as Precision[]).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={draft.precision === p} data-on={draft.precision === p} onClick={() => set('precision', p)}>
                {p === 'ville' ? 'La ville' : 'La région seulement'}
              </button>
            ))}
          </div>
        </div>
        <p className="hint">Jamais d’adresse : seule une grande ville (ou ta région) est visible, et la carte ne montre une ville qu’à partir de 3 entrepreneurs.</p>

        <label className="field">
          <span>Description <small className="mono">{draft.bio.length}/{LIMITS.bio}</small></span>
          <textarea className="input" rows={4} value={draft.bio} maxLength={LIMITS.bio} placeholder="Ce que tu fais, ce que tu cherches…" onChange={(e) => set('bio', e.target.value)} />
        </label>

        <div className="net-switch-row">
          <span>
            <b>Profil visible</b>
            <small>Apparaître dans Découvrir et sur la carte.</small>
          </span>
          <button type="button" className="switch" data-on={draft.visible} aria-pressed={draft.visible} aria-label="Profil visible" onClick={() => set('visible', !draft.visible)}>
            <i />
          </button>
        </div>
        <div className="net-switch-row">
          <span>
            <b>Accepter les messages</b>
            <small>Les autres membres peuvent t’écrire en privé.</small>
          </span>
          <button type="button" className="switch" data-on={draft.openToMessages} aria-pressed={draft.openToMessages} aria-label="Accepter les messages" onClick={() => set('openToMessages', !draft.openToMessages)}>
            <i />
          </button>
        </div>

        <button className="btn btn-accent" style={{ marginTop: 16 }} onClick={save} disabled={busy}>
          {busy ? 'Enregistrement…' : firstTime ? 'Créer mon profil' : 'Enregistrer'}
        </button>
        {saved ? <div className="banner" role="status">Profil enregistré.</div> : null}
        {error ? <div className="banner warn" role="alert">{error}</div> : null}
      </div>
    </div>
  );
}
