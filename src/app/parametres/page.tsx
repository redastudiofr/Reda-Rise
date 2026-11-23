'use client';

import { useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { Toast } from '@/components/Toast';

type Row = {
  label: string;
  icon: IconName;
  color: string;
  value?: string;
  tag?: string;
};

const GENERAL: Row[] = [
  { label: 'Langue', icon: 'globe', color: '#5b9cf0', value: 'Système' },
  { label: 'Apparence', icon: 'moon', color: '#8e7cf2', value: 'Sombre' },
  { label: "Icône de l'application", icon: 'square', color: '#a46ce6', value: 'Sombre' },
  { label: 'Rappels', icon: 'bell', color: '#f0a04b', tag: 'Nouveau' },
];

export default function SettingsPage() {
  const [toast, setToast] = useState<string | null>(null);
  const soon = () => setToast('Bientôt disponible');

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Paramètres</h1>
      </div>

      <div className="stack stagger">
        <div className="card profile">
          <span className="avatar">
            <Icon name="user" size={38} strokeWidth={1.6} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="profile-name">Alexian</div>
            <div className="profile-sub">
              <Icon name="phone" size={15} strokeWidth={2} />
              Sur l&apos;appareil · sans compte
            </div>
          </div>
          <button className="icon-btn" aria-label="Modifier le profil" onClick={soon}>
            <Icon name="pencil" size={22} />
          </button>
        </div>

        <div className="card pro" onClick={soon} role="button" tabIndex={0}>
          <span className="pro-art" aria-hidden="true">
            <ProArt />
          </span>
          <div className="pro-badge">
            Hustly <span className="pro-tag">PRO</span>
          </div>
          <h3>Plus pour vos habitudes.</h3>
          <p>Habitudes illimitées, tous les widgets et statistiques complètes.</p>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Découvrir Pro <Icon name="arrow" size={20} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <h2 className="group-title">Général</h2>
      <div className="card settings stagger">
        {GENERAL.map((r) => (
          <button key={r.label} className="setting" onClick={soon}>
            <span className="setting-ico" style={{ background: r.color }}>
              <Icon name={r.icon} size={22} strokeWidth={2} />
            </span>
            <span className="setting-label">
              {r.label}
              {r.tag && <span className="tag-new">{r.tag}</span>}
            </span>
            {r.value && <span className="setting-value">{r.value}</span>}
            <span className="setting-chev">
              <Icon name="chevron" size={20} strokeWidth={2.2} />
            </span>
          </button>
        ))}
      </div>

      <Toast message={toast} />
    </>
  );
}

/** Illustration décorative (deux tuiles empilées), sans emoji. */
function ProArt() {
  return (
    <svg width="112" height="92" viewBox="0 0 112 92" aria-hidden="true">
      <defs>
        <linearGradient id="tileA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f1ea" />
          <stop offset="1" stopColor="#cfc9bd" />
        </linearGradient>
        <linearGradient id="tileB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a40" />
          <stop offset="1" stopColor="#17171a" />
        </linearGradient>
      </defs>
      <rect x="4" y="18" width="56" height="56" rx="16" fill="url(#tileA)" transform="rotate(-8 32 46)" />
      <path d="M18 46l7 7 13-14" fill="none" stroke="#2a2a2e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-8 32 46)" />
      <rect x="50" y="10" width="56" height="56" rx="16" fill="url(#tileB)" transform="rotate(6 78 38)" />
      <rect x="66" y="34" width="6" height="18" rx="2" fill="#f4f1ea" transform="rotate(6 78 38)" />
      <rect x="77" y="26" width="6" height="26" rx="2" fill="#f4f1ea" transform="rotate(6 78 38)" />
      <rect x="88" y="20" width="6" height="32" rx="2" fill="#f4f1ea" transform="rotate(6 78 38)" />
    </svg>
  );
}
